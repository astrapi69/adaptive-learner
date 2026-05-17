"""Initial adaptive-learning domain.

Creates the 13 tables defined in ``app.models`` (Phase 1B):
users, user_settings, learning_projects, learning_profiles,
curriculums, learning_topics (self-referential tree),
lessons, learning_sessions, session_messages, session_ratings,
session_notes, progress_commits, method_switches.

Generated via ``alembic revision --autogenerate`` from an empty
schema against the Phase 1B models; only the file name and header
were normalised. ``render_as_batch=True`` (see migrations/env.py)
lets SQLite handle CASCADE / SET NULL via batch-mode ALTER table
rewrites if a later migration touches these definitions.

Revision ID: 0001_initial_domain
Revises:
Create Date: 2026-05-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial_domain"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create every Phase 1B table + index."""
    op.create_table('users',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('email', sa.String(length=320), nullable=True),
    sa.Column('language', sa.String(length=10), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )
    op.create_table('curriculums',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('title', sa.String(length=500), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('language', sa.String(length=10), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('curriculums', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_curriculums_user_id'), ['user_id'], unique=False)

    op.create_table('learning_projects',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('topic', sa.String(length=500), nullable=False),
    sa.Column('goal', sa.Text(), nullable=False),
    sa.Column('timeframe', sa.String(length=100), nullable=False),
    sa.Column('daily_minutes', sa.Integer(), nullable=False),
    sa.Column('current_problem', sa.Text(), nullable=True),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('learning_projects', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_learning_projects_user_id'), ['user_id'], unique=False)

    op.create_table('user_settings',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('active_provider', sa.String(length=50), nullable=False),
    sa.Column('api_key_anthropic', sa.Text(), nullable=True),
    sa.Column('api_key_openai', sa.Text(), nullable=True),
    sa.Column('api_key_gemini', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    op.create_table('learning_profiles',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('project_id', sa.String(length=36), nullable=False),
    sa.Column('deductive', sa.Float(), nullable=False),
    sa.Column('inductive', sa.Float(), nullable=False),
    sa.Column('error_based', sa.Float(), nullable=False),
    sa.Column('dialogic', sa.Float(), nullable=False),
    sa.Column('contextual', sa.Float(), nullable=False),
    sa.Column('ai_adaptive', sa.Float(), nullable=False),
    sa.Column('assessed_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['project_id'], ['learning_projects.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('learning_profiles', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_learning_profiles_project_id'), ['project_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_learning_profiles_user_id'), ['user_id'], unique=False)

    op.create_table('learning_sessions',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('project_id', sa.String(length=36), nullable=False),
    sa.Column('method', sa.String(length=50), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('cycle_step', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.ForeignKeyConstraint(['project_id'], ['learning_projects.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('learning_sessions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_learning_sessions_project_id'), ['project_id'], unique=False)

    op.create_table('learning_topics',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('curriculum_id', sa.String(length=36), nullable=False),
    sa.Column('parent_id', sa.String(length=36), nullable=True),
    sa.Column('title', sa.String(length=500), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('order_index', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['curriculum_id'], ['curriculums.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['parent_id'], ['learning_topics.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('learning_topics', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_learning_topics_curriculum_id'), ['curriculum_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_learning_topics_parent_id'), ['parent_id'], unique=False)

    op.create_table('lessons',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('curriculum_id', sa.String(length=36), nullable=False),
    sa.Column('title', sa.String(length=500), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('order_index', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['curriculum_id'], ['curriculums.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('lessons', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_lessons_curriculum_id'), ['curriculum_id'], unique=False)

    op.create_table('method_switches',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('project_id', sa.String(length=36), nullable=False),
    sa.Column('from_method', sa.String(length=50), nullable=False),
    sa.Column('to_method', sa.String(length=50), nullable=False),
    sa.Column('reason', sa.Text(), nullable=False),
    sa.Column('switched_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['project_id'], ['learning_projects.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('method_switches', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_method_switches_project_id'), ['project_id'], unique=False)

    op.create_table('progress_commits',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('project_id', sa.String(length=36), nullable=False),
    sa.Column('session_id', sa.String(length=36), nullable=False),
    sa.Column('method', sa.String(length=50), nullable=False),
    sa.Column('understanding', sa.Float(), nullable=False),
    sa.Column('stress', sa.Float(), nullable=False),
    sa.Column('error_rate', sa.Float(), nullable=False),
    sa.Column('duration_minutes', sa.Integer(), nullable=False),
    sa.Column('committed_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['project_id'], ['learning_projects.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['session_id'], ['learning_sessions.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('progress_commits', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_progress_commits_project_id'), ['project_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_progress_commits_session_id'), ['session_id'], unique=False)

    op.create_table('session_messages',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('session_id', sa.String(length=36), nullable=False),
    sa.Column('role', sa.String(length=20), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['session_id'], ['learning_sessions.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('session_messages', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_session_messages_session_id'), ['session_id'], unique=False)

    op.create_table('session_notes',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('session_id', sa.String(length=36), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['session_id'], ['learning_sessions.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('session_notes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_session_notes_session_id'), ['session_id'], unique=False)

    op.create_table('session_ratings',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('session_id', sa.String(length=36), nullable=False),
    sa.Column('understanding', sa.Integer(), nullable=False),
    sa.Column('stress', sa.Integer(), nullable=False),
    sa.Column('method_fit', sa.Integer(), nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['session_id'], ['learning_sessions.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('session_ratings', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_session_ratings_session_id'), ['session_id'], unique=False)



def downgrade() -> None:
    """Drop every Phase 1B table + index, child-first."""
    with op.batch_alter_table('session_ratings', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_session_ratings_session_id'))

    op.drop_table('session_ratings')
    with op.batch_alter_table('session_notes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_session_notes_session_id'))

    op.drop_table('session_notes')
    with op.batch_alter_table('session_messages', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_session_messages_session_id'))

    op.drop_table('session_messages')
    with op.batch_alter_table('progress_commits', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_progress_commits_session_id'))
        batch_op.drop_index(batch_op.f('ix_progress_commits_project_id'))

    op.drop_table('progress_commits')
    with op.batch_alter_table('method_switches', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_method_switches_project_id'))

    op.drop_table('method_switches')
    with op.batch_alter_table('lessons', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_lessons_curriculum_id'))

    op.drop_table('lessons')
    with op.batch_alter_table('learning_topics', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_learning_topics_parent_id'))
        batch_op.drop_index(batch_op.f('ix_learning_topics_curriculum_id'))

    op.drop_table('learning_topics')
    with op.batch_alter_table('learning_sessions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_learning_sessions_project_id'))

    op.drop_table('learning_sessions')
    with op.batch_alter_table('learning_profiles', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_learning_profiles_user_id'))
        batch_op.drop_index(batch_op.f('ix_learning_profiles_project_id'))

    op.drop_table('learning_profiles')
    op.drop_table('user_settings')
    with op.batch_alter_table('learning_projects', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_learning_projects_user_id'))

    op.drop_table('learning_projects')
    with op.batch_alter_table('curriculums', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_curriculums_user_id'))

    op.drop_table('curriculums')
    op.drop_table('users')
