/**
 * The 4 content pillars, in the exact order they rotate.
 * Order matters: index 0 -> Day 1, index 1 -> Day 2, etc.
 * The rotation NEVER resets on a new week or new month — see src/pillarRotation.js
 */
const PILLARS = [
  {
    id: 'education',
    name: 'Education',
    angle:
      'Helping young people navigate their education choices, understand the modern job market, and make informed academic/career decisions.',
  },
  {
    id: 'digital_skills',
    name: 'Digital Skills',
    angle:
      'Practical, in-demand digital skills young people can learn to become competitive — tools, platforms, mini-tutorials, skill-building paths.',
  },
  {
    id: 'remote_work',
    name: 'Remote Work',
    angle:
      'How to find, land, and succeed at remote work and freelance opportunities — platforms, mindset, pitfalls, routines.',
  },
  {
    id: 'career_development',
    name: 'Career Development',
    angle:
      'Growing and positioning a career long-term — branding, networking, growth mindset, career pivots, workplace skills.',
  },
];

module.exports = { PILLARS };
