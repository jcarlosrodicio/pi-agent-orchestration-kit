---
name: open-design
description: Use the Open Design workbench running on the NAS to create high-quality visual designs, UI prototypes, landing pages, dashboards, pricing pages, docs pages, mobile screens, decks and visual handoff specs.
phase: build
domains:
  - ui-ux
stacks:
  - open-design
allowed_agents:
  - designer
  - lead
  - developer
surfaces:
  - visual-design
  - prototyping
skill_source: built-in
origin: null
status: active
compatibility: opencode
metadata:
  surface: visual-design
  backend: open-design-nas
---

# Open Design Skill

Use this skill when the user asks for:

- visual design
- UX/UI
- landing pages
- SaaS websites
- dashboards
- pricing pages
- documentation pages
- mobile app screens
- onboarding
- decks
- prototypes
- product visuals
- design handoff
- Open Design output
- editable visual projects

## Relationship with PRODUCT.md and DESIGN.md

Before using Open Design, inspect the repository for:

- `PRODUCT.md`
- `DESIGN.md`

These files are the source of truth when present.

If they exist:

- treat them as authoritative
- use them as the primary context for the Open Design prompt
- do not override their product, brand, UX or visual direction
- mention any assumptions or deviations explicitly

If one or both are missing:

- the designer agent must load the `impeccable` skill first
- use Impeccable to construct or propose the missing product/design context
- create or propose:
  - `PRODUCT.md`
  - `DESIGN.md`
- only then create or generate the project in Open Design

Do not create a final Open Design project from vague context if product/design context is missing and Impeccable is available.

## Open Design workbench

The Open Design workbench is configured through:

`OPEN_DESIGN_URL`

Resolve the tool `baseUrl` from approved configuration or explicit user/lead-provided context before calling Open Design tools. Do not invent, guess, or hardcode a URL. If no approved `baseUrl` is available, stop and ask for the missing configuration/context instead of trying a fallback.

Always use the OpenCode tools:

- `open_design_health`
- `open_design_list_agents`
- `open_design_list_skills`
- `open_design_list_design_systems`
- `open_design_create_project`
- `open_design_run_design`

Never try:

- `localhost`
- `127.0.0.1`
- guessed ports
- public Synology domain
- manually composed URLs
- hardcoded `baseUrl` values

If the workbench is unavailable, report the failure and stop.

Pass the resolved `baseUrl` to every Open Design tool call, including health, list, create, and run calls.

## Default behavior

For visual work, use Open Design as the primary design workbench.

Default flow:

1. Check repository design context.
2. Read `PRODUCT.md` and `DESIGN.md` when present.
3. If missing, require the designer agent to use `impeccable` first.
4. Resolve `baseUrl` from approved configuration/context; stop and ask if missing.
5. Check Open Design health with `open_design_health` and the resolved `baseUrl`.
6. List available agents with `open_design_list_agents` and the resolved `baseUrl`.
7. List skills if the correct skill is unclear, passing the resolved `baseUrl`.
8. List design systems if the correct design system is unclear, passing the resolved `baseUrl`.
9. Select the best Open Design skill.
10. Select the best design system.
11. Create an Open Design project or run the design generation with the resolved `baseUrl`.
12. Return the Open Design project URL.
13. Provide implementation handoff for the developer.

## Operating modes

### Workbench mode

Use this by default when the user wants an editable design in the Open Design UI.

Use:

`open_design_create_project`

Return:

- project URL
- selected skill
- selected design system
- exact prompt
- developer handoff
- assumptions
- deviations from `PRODUCT.md` or `DESIGN.md`

### Direct generation mode

Use this when the user explicitly asks to generate the design through Open Design.

Use:

`open_design_run_design`

Return:

- project URL
- generated files
- selected skill
- selected design system
- design summary
- developer handoff
- assumptions
- deviations from `PRODUCT.md` or `DESIGN.md`

### Handoff mode

Use this when the user only needs design direction.

Return:

- design brief
- selected Open Design skill
- selected design system
- visual direction
- implementation notes
- prompt ready for Open Design
- risks and assumptions

## Prompt composition

When creating or running an Open Design project, compose the prompt with this structure:

1. Product context.
2. Design context.
3. Existing repo constraints.
4. User request.
5. Desired artifact.
6. Selected Open Design skill.
7. Selected design system.
8. Content requirements.
9. Layout requirements.
10. Component requirements.
11. Responsive requirements.
12. Accessibility requirements.
13. Anti-slop constraints.
14. Expected output.

Include relevant excerpts or summaries from:

- `PRODUCT.md`
- `DESIGN.md`
- existing tokens/CSS/components
- user instructions

Do not paste excessive irrelevant code into the prompt.

## Skill selection

Use these mappings:

- SaaS landing / marketing page: `saas-landing`
- Generic web prototype: `web-prototype`
- Dashboard / admin / analytics: `dashboard`
- Pricing: `pricing-page`
- Docs page: `docs-page`
- Blog/editorial: `blog-post`
- Mobile app: `mobile-app`
- Mobile onboarding: `mobile-onboarding`
- Deck: `simple-deck` or `guizang-ppt`
- PM/product spec: `pm-spec`
- Motion hero or animated concept: `motion-frames`
- Email marketing: `email-marketing`
- Social carousel: `social-carousel`

If unsure, list Open Design skills before deciding.

## Design system selection

Select the design system from `DESIGN.md` when possible.

When `DESIGN.md` does not provide a clear reference, prefer:

- SaaS / developer tools: `linear`, `vercel`, `stripe`, `cursor`, `supabase`, `resend`, `raycast`
- Consumer/productivity: `apple`, `notion`, `airbnb`, `figma`
- Neutral professional baseline: `neutral-modern` or `default`

If unsure, list Open Design design systems before deciding.

Do not choose a design system only because it is popular. It must match the product, audience and design context.

## PRODUCT.md minimum context

When product context is missing, require a product brief with:

- product name or working title
- problem
- audience
- primary use cases
- value proposition
- main features
- user goals
- business goals
- tone
- constraints
- non-goals

## DESIGN.md minimum context

When design context is missing, require a design brief with:

- design principles
- visual personality
- brand tone
- aesthetic direction
- anti-references
- color direction
- typography direction
- layout principles
- spacing rhythm
- component principles
- interaction principles
- motion principles, if relevant
- accessibility rules
- anti-slop rules

## Anti-slop rules

Avoid:

- generic AI gradients
- vague startup copy
- fake metrics
- fake testimonials
- emoji as primary UI icons
- inconsistent spacing
- meaningless glassmorphism
- unsupported brand colors
- over-rounded generic cards
- nested cards without information hierarchy
- weak hero sections
- decorative noise without purpose

Prefer:

- strong hierarchy
- credible content structure
- restrained palette
- clear responsive behavior
- implementable components
- accessible contrast
- realistic empty/loading/error states when relevant
- clear handoff for developer
- systematic spacing
- deliberate typography
- product-specific interaction details

## Handoff requirements

Every Open Design result should include enough detail for implementation:

- screen or section list
- layout structure
- component breakdown
- state list
- visual tokens
- responsive behavior
- interaction notes
- accessibility notes
- copy assumptions
- assets required
- implementation risks
- visual acceptance criteria

## Required output

Always return:

1. Design goal.
2. Repository documents used.
3. Whether Impeccable was needed.
4. Selected Open Design skill.
5. Selected design system.
6. Visual direction.
7. Open Design project URL, when created.
8. Generated files, when available.
9. Prompt used or proposed.
10. Developer handoff.
11. Assumptions, risks and deviations.
