import type { Memory } from './types';

export const sampleMemories: Memory[] = [
  {
    id: '1',
    title: 'First coffee together',
    date: '2024-04-19',
    description: 'The first small ritual that made the rest of the year feel different.',
    milestoneTag: 'First Date',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Coffee cups on a table'
  },
  {
    id: '2',
    title: 'Weekend by the lake',
    date: '2024-06-07',
    description: 'A quiet trip where time slowed down and every photo felt like a note to the future.',
    milestoneTag: 'Trip',
    imageUrl: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Lake at sunset'
  },
  {
    id: '3',
    title: 'Anniversary dinner',
    date: '2025-02-11',
    description: 'A small table, a long conversation, and the easiest yes of the year.',
    milestoneTag: 'Anniversary',
    imageUrl: 'https://images.unsplash.com/photo-1529543544282-cf5f0b1f1a7d?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Dinner table with candles'
  }
];
