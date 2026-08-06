import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createMemory, deleteMemory, loadMemories } from './api';
import { MemoryModal } from './components/MemoryModal';
import { TimelineCard } from './components/TimelineCard';
import { sampleMemories } from './data';
import type { Memory } from './types';

export default function App() {
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [formState, setFormState] = useState({
    title: '',
    date: new Date().toISOString().slice(0, 10),
    description: '',
    milestoneTag: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    loadMemories()
      .then((loadedMemories) => {
        if (!active) {
          return;
        }

        setMemories(loadedMemories.length > 0 ? loadedMemories : sampleMemories);
      })
      .catch(() => {
        if (active) {
          setMemories(sampleMemories);
          setErrorMessage('The API is offline, so sample memories are shown for now.');
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const sortedMemories = useMemo(
    () => [...memories].sort((left, right) => left.date.localeCompare(right.date)),
    [memories]
  );

  async function handleCreateMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const createdMemory = await createMemory({
      title: formState.title,
      date: formState.date,
      description: formState.description,
      milestoneTag: formState.milestoneTag || undefined,
      imageUrl: sampleMemories[0].imageUrl,
      imageAlt: 'Memory preview image'
    });

    if (createdMemory) {
      setMemories((currentMemories) => [...currentMemories, createdMemory]);
      setSelectedMemory(createdMemory);
      setFormState({
        title: '',
        date: new Date().toISOString().slice(0, 10),
        description: '',
        milestoneTag: ''
      });
    }
  }

  async function handleDeleteMemory(memoryId: string) {
    await deleteMemory(memoryId);
    setMemories((currentMemories) => currentMemories.filter((memory) => memory.id !== memoryId));
    setSelectedMemory(null);
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">UsTogether</p>
        <h1>A horizontal memory timeline built for two.</h1>
        <p className="hero__copy">
          Start with the timeline, then layer in shared workspaces, uploads, and editing flow.
        </p>
      </section>

      <section className="composer" aria-label="add memory">
        <form className="composer__form" onSubmit={handleCreateMemory}>
          <input
            value={formState.title}
            onChange={(event) => setFormState((currentState) => ({ ...currentState, title: event.target.value }))}
            placeholder="Memory title"
            maxLength={50}
            required
          />
          <input
            value={formState.date}
            onChange={(event) => setFormState((currentState) => ({ ...currentState, date: event.target.value }))}
            type="date"
            required
          />
          <input
            value={formState.milestoneTag}
            onChange={(event) => setFormState((currentState) => ({ ...currentState, milestoneTag: event.target.value }))}
            placeholder="Milestone tag"
            maxLength={40}
          />
          <textarea
            value={formState.description}
            onChange={(event) => setFormState((currentState) => ({ ...currentState, description: event.target.value }))}
            placeholder="Write what happened..."
            maxLength={250}
            rows={4}
            required
          />
          <button className="button" type="submit">Add memory</button>
        </form>
        {errorMessage ? <p className="composer__error">{errorMessage}</p> : null}
      </section>

      <section className="timeline-stage" aria-label="memory timeline">
        {isLoading ? <p className="timeline-stage__status">Loading memories...</p> : null}
        <div className="timeline-track">
          {sortedMemories.map((memory, index) => (
            <TimelineCard
              key={memory.id}
              memory={memory}
              onOpen={setSelectedMemory}
              rotation={index % 2 === 0 ? -2 : 2}
            />
          ))}
        </div>
      </section>

      <MemoryModal
        memory={selectedMemory}
        onClose={() => setSelectedMemory(null)}
        onDelete={handleDeleteMemory}
      />
    </main>
  );
}
