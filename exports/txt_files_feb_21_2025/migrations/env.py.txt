import logging
from logging.config import fileConfig
from flask import current_app
from alembic import context
import sqlalchemy as sa

# Set up Python logging from Alembic configuration
# This uses the Alembic configuration file (alembic.ini) for logging setup
fileConfig(context.config.config_file_name)
logger = logging.getLogger('alembic.env')

# Enable detailed SQLAlchemy logging
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)  # Log all SQL statements
logging.getLogger('sqlalchemy.dialects').setLevel(logging.DEBUG)  # Log SQL dialect operations
logging.getLogger('alembic.runtime.migration').setLevel(logging.DEBUG)  # Log migration details

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
fileConfig(config.config_file_name)
logger = logging.getLogger('alembic.env')

# Set up detailed logging for SQLAlchemy
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)

def get_engine():
    try:
        # this works with Flask-SQLAlchemy<3 and Alchemical
        engine = current_app.extensions['migrate'].db.get_engine()
        logger.info("Successfully retrieved database engine.")
        return engine
    except (TypeError, AttributeError):
        # this works with Flask-SQLAlchemy>=3
        engine = current_app.extensions['migrate'].db.engine
        logger.info("Successfully retrieved database engine (SQLAlchemy>=3).")
        return engine
    except Exception as e:
        logger.error("Error retrieving database engine: %s", e)
        raise

def get_engine_url():
    try:
        url = get_engine().url.render_as_string(hide_password=False).replace('%', '%%')
        logger.info("Database URL: %s", url)
        return url
    except AttributeError:
        url = str(get_engine().url).replace('%', '%%')
        logger.info("Database URL: %s", url)
        return url
    except Exception as e:
        logger.error("Error constructing database URL: %s", e)
        raise

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
config.set_main_option('sqlalchemy.url', get_engine_url())
target_db = current_app.extensions['migrate'].db

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.

def get_metadata():
    if hasattr(target_db, 'metadatas'):
        logger.info("Using multiple metadatas.")
        return target_db.metadatas[None]
    logger.info("Using single metadata.")
    return target_db.metadata

def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    logger.info("Running migrations in offline mode.")
    try:
        url = config.get_main_option("sqlalchemy.url")
        context.configure(
            url=url, target_metadata=get_metadata(), literal_binds=True
        )

        with context.begin_transaction():
            context.run_migrations()
        logger.info("Offline migrations completed successfully.")
    except Exception as e:
        logger.error("Error during offline migrations: %s", e)
        raise

def run_migrations_online():
    """Run migrations in 'online' mode."""
    logger.info("Running migrations in online mode.")

    def process_revision_directives(context, revision, directives):
        if getattr(config.cmd_opts, 'autogenerate', False):
            script = directives[0]
            if script.upgrade_ops.is_empty():
                directives[:] = []
                logger.info('No changes in schema detected.')

    conf_args = current_app.extensions['migrate'].configure_args
    if conf_args.get("process_revision_directives") is None:
        conf_args["process_revision_directives"] = process_revision_directives

    connectable = get_engine()

    try:
        with connectable.connect() as connection:
            logger.info("Database connection established.")

            context.configure(
                connection=connection,
                target_metadata=get_metadata(),
                **conf_args
            )

            with context.begin_transaction():
                logger.info("Migration transaction started.")
                context.run_migrations()
                logger.info("Migration transaction completed.")
    except Exception as e:
        logger.error("Error during online migrations: %s", e)
        raise

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()