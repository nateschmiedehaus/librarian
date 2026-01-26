/**
 * @fileoverview Domain Expertise Module
 *
 * Comprehensive domain-specific knowledge covering ALL roles and specializations
 * in software development with world-class inspirations, techniques, methods,
 * tools, and skills for each domain.
 */

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------

export interface DomainExpertise {
  id: string;
  name: string;
  category: DomainCategory;
  description: string;
  worldClassInspirations: Inspiration[];
  techniques: Technique[];
  methods: Method[];
  tools: Tool[];
  skills: Skill[];
  qualityStandards: QualityStandard[];
  antiPatterns: AntiPattern[];
  resources: Resource[];
}

export type DomainCategory =
  | 'design_creative'
  | 'content_communication'
  | 'frontend_client'
  | 'backend_infrastructure'
  | 'data_analytics'
  | 'quality_testing'
  | 'product_management'
  | 'specialized_industry'
  | 'operations_support'
  | 'architecture_systems'
  | 'security_compliance'
  | 'developer_experience';

export interface Inspiration {
  name: string;
  type: 'company' | 'person' | 'project' | 'book' | 'methodology';
  description: string;
  keyLessons: string[];
  reference?: string;
}

export interface Technique {
  name: string;
  description: string;
  when: string;
  howTo: string[];
  benefits: string[];
  pitfalls: string[];
}

export interface Method {
  name: string;
  origin?: string;
  description: string;
  steps: string[];
  artifacts: string[];
  metrics?: string[];
}

export interface Tool {
  name: string;
  category: string;
  purpose: string;
  alternatives?: string[];
  bestFor: string;
}

export interface Skill {
  name: string;
  level: 'foundational' | 'intermediate' | 'advanced' | 'expert';
  description: string;
  howToDevelop: string[];
}

export interface QualityStandard {
  name: string;
  metric: string;
  target: string;
  measurement: string;
}

export interface AntiPattern {
  name: string;
  description: string;
  symptoms: string[];
  solution: string;
}

export interface Resource {
  title: string;
  type: 'book' | 'course' | 'article' | 'video' | 'community';
  url?: string;
  description: string;
}

// ---------------------------------------------------------------------------
// DESIGN & CREATIVE DOMAINS
// ---------------------------------------------------------------------------

export const UI_UX_DESIGN: DomainExpertise = {
  id: 'ui-ux-design',
  name: 'UI/UX Design',
  category: 'design_creative',
  description: 'User interface and experience design for digital products',
  worldClassInspirations: [
    {
      name: 'Apple Design Team',
      type: 'company',
      description: 'Gold standard for intuitive, beautiful interfaces',
      keyLessons: ['Obsessive attention to detail', 'Consistency across ecosystem', 'Animation as communication'],
    },
    {
      name: 'Stripe',
      type: 'company',
      description: 'Developer-focused design that makes complex simple',
      keyLessons: ['Progressive disclosure', 'Documentation as product', 'API-first thinking'],
    },
    {
      name: 'Don Norman',
      type: 'person',
      description: 'Father of UX, author of "Design of Everyday Things"',
      keyLessons: ['Affordances', 'Signifiers', 'Mental models', 'Error prevention'],
    },
    {
      name: 'Linear',
      type: 'company',
      description: 'Modern software design with exceptional polish',
      keyLessons: ['Speed as feature', 'Keyboard-first', 'Crafted animations'],
    },
    {
      name: 'Figma',
      type: 'company',
      description: 'Collaborative design tool that changed the industry',
      keyLessons: ['Real-time collaboration', 'Browser-first', 'Community-driven'],
    },
  ],
  techniques: [
    {
      name: 'Jobs To Be Done (JTBD)',
      description: 'Focus on what users are trying to accomplish, not features',
      when: 'Starting new features, understanding user needs',
      howTo: [
        'Interview users about their goals, not preferences',
        'Identify the "job" the user is hiring your product for',
        'Map the entire journey from trigger to satisfaction',
        'Design for the outcome, not the task',
      ],
      benefits: ['User-centered thinking', 'Avoids feature creep', 'Clear success metrics'],
      pitfalls: ['Can be too abstract', 'Requires quality research'],
    },
    {
      name: 'Design Tokens',
      description: 'Systematic approach to design decisions as data',
      when: 'Building design systems, ensuring consistency',
      howTo: [
        'Define primitive tokens (colors, spacing, typography)',
        'Create semantic tokens (primary-action, error-state)',
        'Use tokens in both design tools and code',
        'Version and document token changes',
      ],
      benefits: ['Single source of truth', 'Easy theming', 'Developer handoff'],
      pitfalls: ['Over-tokenization', 'Maintenance overhead'],
    },
    {
      name: 'Progressive Disclosure',
      description: 'Show only what\'s needed, reveal complexity gradually',
      when: 'Complex features, onboarding, power user tools',
      howTo: [
        'Identify primary vs secondary actions',
        'Default to simplest view',
        'Provide clear paths to advanced features',
        'Use contextual reveals (hover, expand, modal)',
      ],
      benefits: ['Reduced cognitive load', 'Accessible to beginners', 'Power users still served'],
      pitfalls: ['Hidden features may be undiscoverable', 'Too many levels'],
    },
  ],
  methods: [
    {
      name: 'Double Diamond',
      origin: 'UK Design Council',
      description: 'Diverge-converge twice: discover, define, develop, deliver',
      steps: [
        'Discover: Research and explore the problem space',
        'Define: Synthesize findings into problem statement',
        'Develop: Generate and prototype solutions',
        'Deliver: Test, refine, and ship',
      ],
      artifacts: ['Research findings', 'Problem statement', 'Prototypes', 'Final designs'],
    },
    {
      name: 'Design Sprint',
      origin: 'Google Ventures',
      description: '5-day process to answer critical business questions',
      steps: [
        'Monday: Map the problem and pick a target',
        'Tuesday: Sketch competing solutions',
        'Wednesday: Decide on best solution',
        'Thursday: Build a realistic prototype',
        'Friday: Test with real users',
      ],
      artifacts: ['Sprint brief', 'Sketches', 'Storyboard', 'Prototype', 'User feedback'],
    },
  ],
  tools: [
    { name: 'Figma', category: 'Design', purpose: 'UI design and prototyping', bestFor: 'Collaborative design' },
    { name: 'Framer', category: 'Prototyping', purpose: 'High-fidelity interactive prototypes', bestFor: 'Complex interactions' },
    { name: 'Maze', category: 'Testing', purpose: 'Unmoderated usability testing', bestFor: 'Quick validation' },
    { name: 'Hotjar', category: 'Analytics', purpose: 'Heatmaps and session recordings', bestFor: 'Understanding behavior' },
    { name: 'Storybook', category: 'Documentation', purpose: 'Component documentation', bestFor: 'Design system development' },
  ],
  skills: [
    { name: 'Visual Hierarchy', level: 'foundational', description: 'Guiding attention through size, color, contrast', howToDevelop: ['Study typography', 'Analyze great designs', 'Practice with constraints'] },
    { name: 'Interaction Design', level: 'intermediate', description: 'Designing how users interact with interfaces', howToDevelop: ['Learn animation principles', 'Study micro-interactions', 'Build prototypes'] },
    { name: 'Systems Thinking', level: 'advanced', description: 'Designing scalable, consistent systems', howToDevelop: ['Build a design system', 'Study atomic design', 'Maintain documentation'] },
    { name: 'Research Synthesis', level: 'expert', description: 'Turning research into actionable insights', howToDevelop: ['Conduct many interviews', 'Practice affinity mapping', 'Present findings regularly'] },
  ],
  qualityStandards: [
    { name: 'Usability', metric: 'Task success rate', target: '>95%', measurement: 'Usability testing' },
    { name: 'Accessibility', metric: 'WCAG compliance', target: 'AA minimum', measurement: 'Automated + manual audit' },
    { name: 'Consistency', metric: 'Design token coverage', target: '100%', measurement: 'Design system audit' },
    { name: 'Performance', metric: 'Largest Contentful Paint', target: '<2.5s', measurement: 'Lighthouse' },
  ],
  antiPatterns: [
    { name: 'Design by Committee', description: 'Too many stakeholders dilute the vision', symptoms: ['Endless revisions', 'Frankendesign', 'No clear owner'], solution: 'Establish design authority and clear decision process' },
    { name: 'Pixel Perfectionism', description: 'Over-focusing on details before validating concept', symptoms: ['Slow iteration', 'Resistance to feedback', 'Beautiful but useless'], solution: 'Validate early with low-fidelity, polish later' },
  ],
  resources: [
    { title: 'Refactoring UI', type: 'book', description: 'Practical visual design for developers' },
    { title: 'Nielsen Norman Group', type: 'article', url: 'https://www.nngroup.com', description: 'Research-based UX guidance' },
    { title: 'Laws of UX', type: 'article', url: 'https://lawsofux.com', description: 'Psychology principles for design' },
  ],
};

export const GRAPHIC_DESIGN: DomainExpertise = {
  id: 'graphic-design',
  name: 'Graphic Design',
  category: 'design_creative',
  description: 'Visual communication through typography, imagery, and composition',
  worldClassInspirations: [
    { name: 'Paula Scher', type: 'person', description: 'Pentagram partner, bold typography', keyLessons: ['Type as image', 'Breaking rules purposefully', 'Cultural context'] },
    { name: 'Sagmeister & Walsh', type: 'company', description: 'Provocative, emotional design', keyLessons: ['Concept-driven work', 'Craftsmanship', 'Personal expression'] },
    { name: 'Pentagram', type: 'company', description: 'World\'s largest independent design consultancy', keyLessons: ['Partner model', 'Diverse styles', 'Long-term relationships'] },
    { name: 'Swiss Design (International Typographic Style)', type: 'methodology', description: 'Clean, objective, grid-based design', keyLessons: ['Grid systems', 'Sans-serif typography', 'White space'] },
  ],
  techniques: [
    { name: 'Grid Systems', description: 'Mathematical structure for layout', when: 'Any multi-element composition', howTo: ['Define columns and gutters', 'Establish baseline grid', 'Allow for breaking the grid intentionally'], benefits: ['Consistency', 'Faster decisions', 'Professional appearance'], pitfalls: ['Rigidity', 'Boring if over-applied'] },
    { name: 'Color Theory', description: 'Strategic use of color relationships', when: 'Brand development, any visual work', howTo: ['Understand color wheel relationships', 'Consider cultural meanings', 'Test for accessibility', 'Use 60-30-10 rule'], benefits: ['Emotional impact', 'Brand recognition', 'Visual hierarchy'], pitfalls: ['Ignoring accessibility', 'Trend-chasing'] },
    { name: 'Visual Hierarchy', description: 'Guiding the eye through composition', when: 'Every design', howTo: ['Establish focal point', 'Use size contrast', 'Apply color strategically', 'Consider reading patterns'], benefits: ['Clear communication', 'Engagement', 'Comprehension'], pitfalls: ['Everything emphasized = nothing emphasized'] },
  ],
  methods: [
    { name: 'Mood Board Process', description: 'Visual exploration before execution', steps: ['Gather diverse references', 'Identify patterns and themes', 'Curate to coherent direction', 'Present and refine with stakeholders'], artifacts: ['Mood board', 'Style keywords', 'Direction rationale'] },
  ],
  tools: [
    { name: 'Adobe Illustrator', category: 'Vector', purpose: 'Vector graphics and illustration', bestFor: 'Logos, icons, print' },
    { name: 'Adobe Photoshop', category: 'Raster', purpose: 'Photo editing and manipulation', bestFor: 'Photo-based work' },
    { name: 'Affinity Designer', category: 'Vector', purpose: 'Professional vector design', bestFor: 'One-time purchase alternative' },
    { name: 'Canva', category: 'Templates', purpose: 'Quick marketing materials', bestFor: 'Non-designers, speed' },
  ],
  skills: [
    { name: 'Typography', level: 'foundational', description: 'Selecting and pairing typefaces', howToDevelop: ['Study type anatomy', 'Analyze font pairings', 'Practice setting type'] },
    { name: 'Composition', level: 'intermediate', description: 'Arranging elements effectively', howToDevelop: ['Study masters', 'Practice with constraints', 'Get critique'] },
    { name: 'Conceptual Thinking', level: 'advanced', description: 'Ideas that communicate beyond aesthetics', howToDevelop: ['Study award-winning campaigns', 'Practice brainstorming', 'Develop multiple concepts'] },
  ],
  qualityStandards: [
    { name: 'Print Resolution', metric: 'DPI', target: '300 DPI minimum', measurement: 'File properties' },
    { name: 'Color Accuracy', metric: 'Color profile', target: 'Correct profile for medium', measurement: 'Soft proofing' },
    { name: 'Brand Consistency', metric: 'Style guide compliance', target: '100%', measurement: 'Brand audit' },
  ],
  antiPatterns: [
    { name: 'Decoration over Communication', description: 'Pretty but meaningless', symptoms: ['No clear message', 'Style without substance'], solution: 'Start with concept, then execute' },
    { name: 'Trend Chasing', description: 'Following trends without purpose', symptoms: ['Dated quickly', 'Generic look'], solution: 'Understand why trends work, apply selectively' },
  ],
  resources: [
    { title: 'Thinking with Type', type: 'book', description: 'Essential typography guide by Ellen Lupton' },
    { title: 'Grid Systems in Graphic Design', type: 'book', description: 'Josef Müller-Brockmann\'s seminal work' },
  ],
};

export const MOTION_DESIGN: DomainExpertise = {
  id: 'motion-design',
  name: 'Motion Design & Animation',
  category: 'design_creative',
  description: 'Bringing interfaces and graphics to life through movement',
  worldClassInspirations: [
    { name: 'Buck', type: 'company', description: 'Award-winning motion design studio', keyLessons: ['Storytelling through motion', 'Craft excellence', 'Creative culture'] },
    { name: 'Stripe', type: 'company', description: 'Subtle, purposeful UI animation', keyLessons: ['Animation as feedback', 'Performance-conscious', 'Restraint'] },
    { name: 'Disney Animation Principles', type: 'methodology', description: '12 principles that make animation feel alive', keyLessons: ['Squash and stretch', 'Anticipation', 'Follow through', 'Ease in/out'] },
    { name: 'Material Design Motion', type: 'methodology', description: 'Google\'s systematic approach to UI motion', keyLessons: ['Choreography', 'Shared axis', 'Meaningful transitions'] },
  ],
  techniques: [
    { name: 'Easing Functions', description: 'Natural acceleration and deceleration', when: 'Every animation', howTo: ['Avoid linear motion', 'Use ease-out for entrances', 'Use ease-in for exits', 'Custom curves for character'], benefits: ['Natural feel', 'Polish', 'User comfort'], pitfalls: ['Over-easing feels sluggish'] },
    { name: 'Staggered Animation', description: 'Sequential reveal of related elements', when: 'Lists, grids, related items', howTo: ['Define consistent delay', 'Keep total duration reasonable', 'Consider reading direction'], benefits: ['Visual interest', 'Guides attention', 'Reduces overwhelm'], pitfalls: ['Too slow feels broken', 'Too fast loses effect'] },
    { name: 'Meaningful Transitions', description: 'Animation that communicates state change', when: 'Navigation, mode changes, feedback', howTo: ['Connect start and end states', 'Use shared elements', 'Maintain spatial consistency'], benefits: ['Orientation', 'Continuity', 'Delight'], pitfalls: ['Gratuitous animation annoys'] },
  ],
  methods: [
    { name: 'Animation Audit', description: 'Systematic review of motion in product', steps: ['Catalog all animations', 'Evaluate purpose of each', 'Check timing consistency', 'Test reduced motion mode', 'Document motion system'], artifacts: ['Motion inventory', 'Timing tokens', 'Motion guidelines'] },
  ],
  tools: [
    { name: 'After Effects', category: 'Animation', purpose: 'Professional motion graphics', bestFor: 'Complex animation, video' },
    { name: 'Lottie', category: 'Implementation', purpose: 'Vector animation for apps/web', bestFor: 'Shipping AE animations to production' },
    { name: 'Rive', category: 'Interactive', purpose: 'Interactive animations', bestFor: 'State-based animations' },
    { name: 'Framer Motion', category: 'Code', purpose: 'React animation library', bestFor: 'Developer-implemented motion' },
    { name: 'GSAP', category: 'Code', purpose: 'JavaScript animation library', bestFor: 'Complex web animations' },
  ],
  skills: [
    { name: '12 Principles of Animation', level: 'foundational', description: 'Disney\'s timeless animation principles', howToDevelop: ['Study classic animation', 'Practice bouncing ball', 'Apply to UI'] },
    { name: 'Timing and Spacing', level: 'intermediate', description: 'Control of motion curves', howToDevelop: ['Experiment with easing', 'Study reference videos', 'Get feedback'] },
    { name: 'Performance Optimization', level: 'advanced', description: 'Smooth 60fps animation', howToDevelop: ['Learn compositor-only properties', 'Profile animations', 'Test on slow devices'] },
  ],
  qualityStandards: [
    { name: 'Frame Rate', metric: 'FPS', target: '60 FPS', measurement: 'DevTools performance' },
    { name: 'Duration', metric: 'Total animation time', target: '200-500ms for UI', measurement: 'Timing audit' },
    { name: 'Reduced Motion', metric: 'prefers-reduced-motion support', target: '100% coverage', measurement: 'Accessibility audit' },
  ],
  antiPatterns: [
    { name: 'Animation for Animation\'s Sake', description: 'Motion without purpose', symptoms: ['User annoyance', 'Slow perceived performance'], solution: 'Every animation must have a communication goal' },
    { name: 'Ignoring Performance', description: 'Beautiful but janky', symptoms: ['Dropped frames', 'Battery drain'], solution: 'Test on low-end devices, use will-change sparingly' },
  ],
  resources: [
    { title: 'The Illusion of Life', type: 'book', description: 'Disney animation bible' },
    { title: 'UI Animation Newsletter', type: 'article', description: 'Weekly curated UI motion examples' },
  ],
};
