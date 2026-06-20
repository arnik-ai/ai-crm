# AI-Native CRM for Educational Institutes — Master Prompt & Spec

> این فایل، پرامپت اصلی و مشخصات پروژه است. معماری و کد بر اساس همین سند تولید می‌شود.

## PROJECT GOAL
Build an AI-Native CRM for educational institutes in Iran, integrated with **Workano Cloud PBX**.
The platform must automatically: track incoming/outgoing/missed calls, store recordings, analyze
conversations, extract student information, detect sales stage, calculate lead score, recommend
next actions, and assist sales managers.

## ARCHITECTURE RULES
Modular · Domain-Driven · Scalable · Clean Architecture · SOLID · Production-Ready. No monolith.
Every module independently maintainable.

## DEPLOYMENT
- No Docker.
- Target: **Parspack PaaS**.
- Source control: **GitHub** with CI/CD (GitHub Actions), env vars, secrets management, production config.

## TELEPHONY (Workano)
Webhook-based. Events: Incoming Call, Outgoing Call, Missed Call, Call Finished, Recording Ready.
Flow: `Workano → Webhook → CRM Backend → AI Processing → PostgreSQL → Dashboard`.
Abstraction: `TelephonyProvider` interface → `WorkanoProvider` (future: Issabel, Asterisk, other PBX).

## AI PROVIDERS (AvalAI)
- LLM: GPT-5.5 via AvalAI
- STT: Whisper via AvalAI
Abstractions: `LLMProvider`, `SpeechToTextProvider` → `AvalAILLMProvider`, `AvalAIWhisperProvider`. Pluggable.

## CRM FEATURES
Student profile, call history (with recording/transcript/summary), activities timeline, sales funnel.

## SALES PIPELINE
New Lead · Contacted · Interested · Consultation · Negotiation · Registration Completed · Lost (custom stages allowed).

## AI ANALYSIS PIPELINE
Webhook → save metadata → download recording → Whisper transcript → GPT-5.5 extraction → update CRM.
Extract: full name, course, educational goal, registration intention, objections, budget concerns,
preferred follow-up date, urgency, purchase signals. Generate: AI summary, lead score, registration
probability, next best action. Structured JSON output.

## LANGGRAPH AGENTS
Transcript · Extraction · Lead Scoring · Sales Stage · Follow-Up · Sales Manager.
Design state models, nodes, edges, error handling, retry strategy, Mermaid diagrams.

## DASHBOARD
Calls today/week, hot/warm/cold leads, follow-ups, conversion rate, sales funnel, team performance.

## AI ASSISTANT (CRM Chat)
"Who should I call today?", "Which students are likely to register?", "Show leads interested in Python",
"Show students with price objections", "Show leads without follow-up for 7 days".

## TECH STACK
Backend: Python 3.12, FastAPI, SQLAlchemy, Alembic, PostgreSQL.
AI: LangGraph, LangChain, AvalAI GPT-5.5, AvalAI Whisper.
Frontend: Next.js 15, React, TypeScript, TailwindCSS, Shadcn UI.
Auth: JWT + refresh tokens. Cache: Redis. Jobs: Celery. Storage: S3-compatible.

## DATABASE TABLES
users, roles, permissions, students, courses, calls, recordings, transcripts, lead_scores,
sales_stages, followups, activities, notes, tags, student_tags, webhook_logs, audit_logs.
Include indexes, constraints, FKs, performance optimization.

## API MODULES
Auth · Students · Calls · Courses · Notes · Tags · Followups · Dashboard · AI Analysis · Workano Webhooks.

## SECURITY
JWT, RBAC, audit logs, encryption at rest, rate limiting, input validation, webhook signature validation.

## PROJECT STRUCTURE
Clean Architecture layers: Domain · Application · Infrastructure · Presentation · Shared.

## DELIVERABLES
High-level + C4 architecture, ERD, LangGraph design, PostgreSQL schema, FastAPI & Next.js structure,
GitHub repo structure, GitHub Actions CI/CD, Parspack deploy strategy, Workano & AvalAI integration,
complete API design, security architecture, MVP & production roadmap, scaling for 100k+ students,
example code skeletons, Mermaid diagrams, technical decisions & tradeoffs.

## OUTPUT
Persian. Extremely detailed. Production-quality, not a prototype.

After completing the architecture, generate the project step-by-step: database schema → backend →
Workano integration → AI integration → LangGraph → frontend. Do not skip code. Generate real,
implementation-ready code files.
