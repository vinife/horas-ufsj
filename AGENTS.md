# Project Guidelines for `horas-ufsj`

This document outlines the conventions, technologies, and structural guidelines for the `horas-ufsj` project. Adhering to these guidelines ensures consistency, maintainability, and efficient collaboration.

## 1. Project Overview

`horas-ufsj` is a web application built with Next.js, designed to manage and track student/admin hours, likely related to academic or extracurricular activities at UFSJ. It features an authentication system, admin and student dashboards, and API endpoints for data management.

## 2. Technologies Used

- **Framework:** Next.js (React)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database/ORM:** Prisma
- **Authentication:** NextAuth.js (implied by `app/api/auth` structure)
- **Package Manager:** Bun (primary), also `npm` for compatibility.
- **Linting/Formatting:** ESLint

## 3. Code Structure

The project follows a standard Next.js app router structure with additional custom directories:

- `app/`: Contains all Next.js routes, API endpoints, and global layouts/styles.
  - `app/(auth)/`: Authentication-related pages (e.g., login).
  - `app/(dashboard)/`: Dashboard pages, segmented by user roles (admin, student).
  - `app/api/`: Backend API routes for various functionalities (uploads, users, notifications).
- `components/`: Reusable React components.
  - `components/ds/`: Design System components specific to the application.
  - `components/ui/`: UI primitives, likely from a UI library (e.g., Shadcn UI).
  - `components/providers/`: Context providers for global state or services.
- `lib/`: Utility functions, hooks, schemas, and authentication logic.
  - `lib/auth/`: Authentication strategies, access control, and permissions.
  - `lib/schemas/`: Zod schemas for data validation.
  - `lib/validators/`: Custom validation logic.
- `prisma/`: Prisma schema, migrations, and seed data.
- `public/`: Static assets (images, fonts, etc.).

## 4. Development Conventions

### 4.1. TypeScript Usage

- Always use TypeScript for new files and components.
- Strive for strong typing. Avoid `any` where possible.
- Define clear interfaces or types for props, state, and API responses.

### 4.2. React Components

- **Functional Components:** Prefer functional components over class components.
- **Naming:** Components should be named in PascalCase (e.g., `MyComponent.tsx`).
- **Props:** Use destructuring for props and define their types clearly.
- **Styling:** Utilize Tailwind CSS classes for styling. Avoid inline styles unless absolutely necessary.
- **Modularity:** Keep components small, focused, and reusable.

### 4.3. Styling with Tailwind CSS

- Use Tailwind CSS utility classes directly in JSX.
- For complex or repetitive styles, consider using `@apply` in `globals.css` or creating custom utility classes (sparingly).
- Ensure responsiveness using Tailwind's breakpoint prefixes.

### 4.4. API Routes (Next.js App Router)

- API routes (`app/api/`) should follow RESTful principles where appropriate.
- Implement robust request validation using Zod schemas (from `lib/schemas`).
- Handle errors gracefully and return appropriate HTTP status codes.
- Protect sensitive routes with authentication and authorization checks (`lib/auth/access-control.ts`).

### 4.5. Prisma Usage

- **Schema:** Define database schema in `prisma/schema.prisma`.
- **Migrations:** Use `prisma migrate dev` for generating and applying migrations. Always review generated migration files.
- **Client:** Use the Prisma Client for all database interactions.
- **Seed Data:** Maintain `prisma/seed.ts` for development data.

### 4.6. Linting and Formatting

- The project uses ESLint for code linting (`eslint.config.mjs`).
- Ensure your editor integrates with ESLint to catch issues during development.
- Run `bun lint` or `npm run lint` before committing to ensure adherence to code style.

## 5. Running the Project

1.  **Install dependencies:**
    ```bash
    bun install
    # or npm install
    ```
2.  **Set up environment variables:** Create a `.env` file based on `.env.example` (if available) and fill in the necessary values (e.g., database URL, auth secrets).
3.  **Database setup:**
    ```bash
    bun prisma migrate dev
    bun prisma db seed
    ```
4.  **Start the development server:**
    ```bash
    bun dev
    # or npm run dev
    ```

## 6. Git Workflow

- Follow a feature-branch workflow.
- Create descriptive commit messages.
- Before pushing, ensure all tests pass and linting checks are clear.
