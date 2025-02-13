import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import io
import base64
import pandas as pd
from datetime import datetime, timedelta
from app.models import Project  # Replace `your_application` with your actual application/module name

# Function to generate burn-up chart
def generate_burnup_chart(project_name):
    current_project = Project.query.filter_by(name=project_name).first()
    if not current_project:
        return None

    # Parse project start and end dates
    start_date = current_project.start_date
    end_date = current_project.end_date
    total_scope = current_project.total_story_points

    # Calculate ideal progress line
    total_days = (end_date - start_date).days or 1
    ideal_progress = [i / total_days * total_scope for i in range(total_days + 1)]

    # Fetch completed points data
    completed_points = sum(task.story_points for task in current_project.tasks if task.completed)
    completed_points_data = [{'date': task.completed_date, 'points': task.story_points} for task in current_project.tasks if task.completed]

    # Default entry if no progress entries are available
    if not completed_points_data:
        completed_points_data = [{'date': current_project.start_date, 'points': 0}]

    # Create DataFrame for completed points and process cumulative progress
    completed_points_df = pd.DataFrame(completed_points_data)
    completed_points_df['date'] = pd.to_datetime(completed_points_df['date'], errors='coerce')
    completed_points_df = completed_points_df.dropna(subset=['date']).set_index('date').resample('D').sum().cumsum()

    # Ensure cumulative progress does not drop by filling forward
    date_range = pd.date_range(start=start_date, end=datetime.now().date(), freq='D')
    completed_points_df = completed_points_df.reindex(date_range, method='ffill').fillna(0)  # Forward-fill missing values
    actual_progress = completed_points_df['points'].values

    # Plotting the chart - set up figure first
    plt.figure(figsize=(10, 6))

    # Plot the ideal progress line
    plt.plot(
        pd.date_range(start=start_date, periods=len(ideal_progress), freq='D'),
        ideal_progress,
        label='Ideal Progress',
        linestyle='--',
        color='blue',
        linewidth=3  # Control the line width here
    )

    # Plot the actual progress
    plt.plot(
        date_range,
        actual_progress,
        label='Actual Work Completed',
        color='green',
        linewidth=3  # Different line width for this line
    )

    # Plot the total scope line
    plt.axhline(
        y=total_scope,
        color='red',
        linestyle='-',
        label='Total Scope',
        linewidth=3  # Line width for horizontal line
    )

    # Forecast line calculations
    total_points_submitted = completed_points_df['points'].iloc[-1]
    days_since_start = (datetime.now().date() - start_date).days or 1
    average_completion_rate = total_points_submitted / days_since_start if days_since_start > 0 else 0

    # Determine forecast only if there is progress; otherwise, skip forecast calculation
    if average_completion_rate > 0:
        remaining_scope = total_scope - total_points_submitted
        if remaining_scope > 0:
            days_to_completion = remaining_scope / average_completion_rate
            forecasted_completion_date = datetime.now().date() + timedelta(days=int(days_to_completion))

            forecast_dates = pd.date_range(start=datetime.now().date(), end=forecasted_completion_date)
            forecast_progress = [total_points_submitted + average_completion_rate * i for i in range(len(forecast_dates))]

            # Debugging outputs
            print(f"Forecasted Completion Date: {forecasted_completion_date}")
            print(f"Forecast Dates: {forecast_dates}")
            print(f"Forecast Progress: {forecast_progress}")

            # Plot the forecast line if there is a forecasted date
            plt.plot(
                forecast_dates,
                forecast_progress,
                label='Forecast',
                linestyle='--',
                color='orange',
                linewidth=3
            )

    # Setting axis labels and title with white text
    plt.xlabel('Date', color='white')
    plt.ylabel('Story Points', color='white')
    plt.title(f'Burn-up Chart for {project_name}', color='white')

    # Customizing tick labels to be white
    plt.xticks(color='white')
    plt.yticks(color='white')

    # Setting legend with white text
    plt.legend(loc='lower right', facecolor='none', edgecolor='none', fontsize='medium', labelcolor='white')

    # Customizing axis lines and spines (border)
    ax = plt.gca()  # Get current axis
    ax.spines['bottom'].set_color('white')
    ax.spines['left'].set_color('white')
    ax.spines['top'].set_color('white')
    ax.spines['right'].set_color('white')

    # Set border (spines) width
    ax.spines['bottom'].set_linewidth(1)
    ax.spines['left'].set_linewidth(1)
    ax.spines['top'].set_linewidth(0)
    ax.spines['right'].set_linewidth(0)

    # Generate the chart image as a base64 string with a transparent background
    buf = io.BytesIO()
    plt.savefig(buf, format='png', transparent=True)  # Save with a transparent background
    buf.seek(0)
    chart_url = base64.b64encode(buf.getvalue()).decode('utf-8')
    plt.close()

    return f"data:image/png;base64,{chart_url}"