import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import io
import base64

def generate_contributor_breakdown_chart(assigned_contributors_count, unassigned_contributors_count):
    labels = ['Assigned to project', 'Available']

    def format_autopct(pct, all_vals):
        absolute = int(round(pct / 100. * sum(all_vals)))
        return f"{pct:.1f}% ({absolute})"

    sizes = [assigned_contributors_count, unassigned_contributors_count]
    colors = ['#ff9999', '#66b3ff', '#99ff99']
    explode = (0.0, 0)

    fig, ax = plt.subplots(figsize=(2.5, 2))  # Set the width of the figure
    fig.subplots_adjust(left=0.0, right=0.7)  # Adjust the position of the subplot

    wedges, texts, autotexts = ax.pie(
        sizes,
        labels=labels,
        autopct=lambda pct: format_autopct(pct, sizes),
        startangle=160,
        colors=colors,
        explode=explode,
        wedgeprops={'edgecolor': 'black'},
        textprops={'color': 'white'}
    )

    # Customizing the appearance of percentage labels
    for autotext in autotexts:
        autotext.set_color('None')  # Set color of percentage text
        autotext.set_fontsize(10)  # Adjust font size if needed

    # Prepare data for tabulation (currently not used without legend)
    # data = [[label, size] for label, size in zip(labels, sizes)]
    # custom_labels = tabulate(data, headers=[], tablefmt="plain", numalign="right", stralign="left").split("\n")

    # Custom handler for creating circular legend markers (not used currently)
    # class HandlerCircle(HandlerPatch):
    #     def create_artists(self, legend, orig_handle, xdescent, ydescent, width, height, fontsize, trans):
    #         center = width / 2, height / 2
    #         # Set a fixed radius or scale it explicitly
    #         radius = orig_handle.get_radius() * fontsize / 10  # Scale relative to fontsize or use a fixed value
    #         circle = Circle(xy=center, radius=radius, color=orig_handle.get_facecolor(),
    #                         edgecolor=orig_handle.get_edgecolor())
    #         self.update_prop(circle, orig_handle, legend)
    #         circle.set_transform(trans)
    #         return [circle]

    # Add a custom legend using circular markers (commented out)
    # legend_elements = [Circle((0, 0), radius=5, color=color, edgecolor='black') for color in colors]
    # ax.legend(
    #     legend_elements,
    #     custom_labels,
    #     handler_map={Circle: HandlerCircle()},
    #     loc='upper right',
    #     bbox_to_anchor=(1.9, 0.8),  # Adjust these values to reposition the legend
    #     frameon=False,  # Remove the frame around the legend
    #     labelspacing=1.2  # Increase this value to add more space between legend items
    # )

    ax.axis('equal')
    buf = io.BytesIO()
    plt.savefig(buf, format='png', transparent=True)
    buf.seek(0)
    chart_data = base64.b64encode(buf.getvalue()).decode('utf-8')
    buf.close()
    plt.close(fig)

    return f"data:image/png;base64,{chart_data}"