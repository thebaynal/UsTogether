import { Router } from 'express';
import { z } from 'zod';
import type { Memory } from '../types';

const router = Router();

let memories: Memory[] = [
  {
    id: '1',
    workspaceId: 'workspace-demo',
    title: 'First coffee together',
    description: 'The first small ritual that made the rest of the year feel different.',
    date: '2024-04-19',
    milestoneTag: 'First Date',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Coffee cups on a table',
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    workspaceId: 'workspace-demo',
    title: 'Weekend by the lake',
    description: 'A quiet trip where time slowed down and every photo felt like a note to the future.',
    date: '2024-06-07',
    milestoneTag: 'Trip',
    imageUrl: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Lake at sunset',
    updatedAt: new Date().toISOString()
  }
];

const memorySchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(1).max(50),
  description: z.string().min(1).max(250),
  date: z.string().min(10),
  milestoneTag: z.string().max(40).optional(),
  imageUrl: z.string().url(),
  imageAlt: z.string().min(1)
});

router.get('/', (_request, response) => {
  const sortedMemories = [...memories].sort((left, right) => left.date.localeCompare(right.date));

  response.json({ memories: sortedMemories });
});

router.post('/', (request, response) => {
  const parsed = memorySchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({ error: 'Invalid memory payload', issues: parsed.error.flatten() });
  }

  const memory: Memory = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    ...parsed.data,
    updatedAt: new Date().toISOString()
  };

  memories = [...memories, memory];
  response.status(201).json({ memory });
});

router.put('/:id', (request, response) => {
  const parsed = memorySchema.partial().safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({ error: 'Invalid memory payload', issues: parsed.error.flatten() });
  }

  const index = memories.findIndex((memory) => memory.id === request.params.id);

  if (index === -1) {
    return response.status(404).json({ error: 'Memory not found' });
  }

  const updatedMemory = {
    ...memories[index],
    ...parsed.data,
    updatedAt: new Date().toISOString()
  };

  memories = [...memories.slice(0, index), updatedMemory, ...memories.slice(index + 1)];
  response.json({ memory: updatedMemory });
});

router.delete('/:id', (request, response) => {
  const exists = memories.some((memory) => memory.id === request.params.id);

  if (!exists) {
    return response.status(404).json({ error: 'Memory not found' });
  }

  memories = memories.filter((memory) => memory.id !== request.params.id);
  response.status(204).send();
});

export { router as memoriesRouter };
