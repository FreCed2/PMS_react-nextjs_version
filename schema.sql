--
-- PostgreSQL database dump
--

-- Dumped from database version 14.15 (Homebrew)
-- Dumped by pg_dump version 14.15 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: pythonproject_user
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO pythonproject_user;

--
-- Name: contributor; Type: TABLE; Schema: public; Owner: pythonproject_user
--

CREATE TABLE public.contributor (
    id integer NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE public.contributor OWNER TO pythonproject_user;

--
-- Name: contributor_id_seq; Type: SEQUENCE; Schema: public; Owner: pythonproject_user
--

CREATE SEQUENCE public.contributor_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.contributor_id_seq OWNER TO pythonproject_user;

--
-- Name: contributor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pythonproject_user
--

ALTER SEQUENCE public.contributor_id_seq OWNED BY public.contributor.id;


--
-- Name: project; Type: TABLE; Schema: public; Owner: pythonproject_user
--

CREATE TABLE public.project (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    completed_story_points integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    scope integer,
    CONSTRAINT no_whitespace_in_name CHECK (((name)::text = TRIM(BOTH FROM name)))
);


ALTER TABLE public.project OWNER TO pythonproject_user;

--
-- Name: project_contributor; Type: TABLE; Schema: public; Owner: pythonproject_user
--

CREATE TABLE public.project_contributor (
    project_id integer NOT NULL,
    contributor_id integer NOT NULL
);


ALTER TABLE public.project_contributor OWNER TO pythonproject_user;

--
-- Name: project_id_seq; Type: SEQUENCE; Schema: public; Owner: pythonproject_user
--

CREATE SEQUENCE public.project_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.project_id_seq OWNER TO pythonproject_user;

--
-- Name: project_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pythonproject_user
--

ALTER SEQUENCE public.project_id_seq OWNED BY public.project.id;


--
-- Name: task; Type: TABLE; Schema: public; Owner: pythonproject_user
--

CREATE TABLE public.task (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    sort_order integer,
    description text,
    task_type character varying(10) DEFAULT 'Subtask'::character varying NOT NULL,
    is_archived boolean DEFAULT false,
    completed boolean DEFAULT false,
    parent_id integer,
    project_id integer NOT NULL,
    contributor_id integer,
    story_points integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_date timestamp without time zone,
    status character varying(20) DEFAULT 'Not Started'::character varying NOT NULL
);


ALTER TABLE public.task OWNER TO pythonproject_user;

--
-- Name: task_id_seq; Type: SEQUENCE; Schema: public; Owner: pythonproject_user
--

CREATE SEQUENCE public.task_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.task_id_seq OWNER TO pythonproject_user;

--
-- Name: task_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pythonproject_user
--

ALTER SEQUENCE public.task_id_seq OWNED BY public.task.id;


--
-- Name: contributor id; Type: DEFAULT; Schema: public; Owner: pythonproject_user
--

ALTER TABLE ONLY public.contributor ALTER COLUMN id SET DEFAULT nextval('public.contributor_id_seq'::regclass);


--
-- Name: project id; Type: DEFAULT; Schema: public; Owner: pythonproject_user
--

ALTER TABLE ONLY public.project ALTER COLUMN id SET DEFAULT nextval('public.project_id_seq'::regclass);


--
-- Name: task id; Type: DEFAULT; Schema: public; Owner: pythonproject_user
--

ALTER TABLE ONLY public.task ALTER COLUMN id SET DEFAULT nextval('public.task_id_seq'::regclass);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: pythonproject_user
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: contributor contributor_name_key; Type: CONSTRAINT; Schema: public; Owner: pythonproject_user
--

ALTER TABLE ONLY public.contributor
    ADD CONSTRAINT contributor_name_key UNIQUE (name);


--
-- Name: contributor contributor_pkey; Type: CONSTRAINT; Schema: public; Owner: pythonproject_user
--

ALTER TABLE ONLY public.contributor
    ADD CONSTRAINT contributor_pkey PRIMARY KEY (id);


--
-- Name: project_contributor project_contributor_pkey; Type: CONSTRAINT; Schema: public; Owner: pythonproject_user
--

ALTER TABLE ONLY public.project_contributor
    ADD CONSTRAINT project_contributor_pkey PRIMARY KEY (project_id, contributor_id);


--
-- Name: project project_name_key; Type: CONSTRAINT; Schema: public; Owner: pythonproject_user
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_name_key UNIQUE (name);


--
-- Name: project project_pkey; Type: CONSTRAINT; Schema: public; Owner: pythonproject_user
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_pkey PRIMARY KEY (id);


--
-- Name: task task_pkey; Type: CONSTRAINT; Schema: public; Owner: pythonproject_user
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_pkey PRIMARY KEY (id);


--
-- Name: ix_task_completed; Type: INDEX; Schema: public; Owner: pythonproject_user
--

CREATE INDEX ix_task_completed ON public.task USING btree (completed);


--
-- Name: ix_task_contributor_id; Type: INDEX; Schema: public; Owner: pythonproject_user
--

CREATE INDEX ix_task_contributor_id ON public.task USING btree (contributor_id);


--
-- Name: ix_task_is_archived; Type: INDEX; Schema: public; Owner: pythonproject_user
--

CREATE INDEX ix_task_is_archived ON public.task USING btree (is_archived);


--
-- Name: ix_task_parent_id; Type: INDEX; Schema: public; Owner: pythonproject_user
--

CREATE INDEX ix_task_parent_id ON public.task USING btree (parent_id);


--
-- Name: ix_task_project_id; Type: INDEX; Schema: public; Owner: pythonproject_user
--

CREATE INDEX ix_task_project_id ON public.task USING btree (project_id);


--
-- Name: project_contributor project_contributor_contributor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pythonproject_user
--

ALTER TABLE ONLY public.project_contributor
    ADD CONSTRAINT project_contributor_contributor_id_fkey FOREIGN KEY (contributor_id) REFERENCES public.contributor(id) ON DELETE CASCADE;


--
-- Name: project_contributor project_contributor_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pythonproject_user
--

ALTER TABLE ONLY public.project_contributor
    ADD CONSTRAINT project_contributor_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: task task_contributor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pythonproject_user
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_contributor_id_fkey FOREIGN KEY (contributor_id) REFERENCES public.contributor(id);


--
-- Name: task task_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pythonproject_user
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.task(id);


--
-- Name: task task_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pythonproject_user
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id);


--
-- PostgreSQL database dump complete
--

