import PropTypes from 'prop-types';

/**
 * Renders a card with a title and description.
 *
 * @component
 * @example
 * return (
 *   <Card title="React" description="A JavaScript library for building UI" />
 * )
 */
const Card = ({ title, description }) => {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
};

Card.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
};

export default Card;