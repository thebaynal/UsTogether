import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createMemory, deleteMemory, loadMemories } from './api';
import { MemoryModal } from './components/MemoryModal';
import { TimelineCard } from './components/TimelineCard';
import { sampleMemories } from './data';
import type { Memory } from './types';

export default function App() {
  const timelineViewportRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedTimelineRef = useRef(false);
  const scrollAnimationFrameRef = useRef<number | null>(null);
  const timelineCardRefs = useRef(new Map<string, HTMLButtonElement>());
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [activeMemoryId, setActiveMemoryId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState('');
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

        setMemories(loadedMemories);
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

  function setTimelineCardRef(memoryId: string, node: HTMLButtonElement | null) {
    if (node) {
      timelineCardRefs.current.set(memoryId, node);
      return;
    }

    timelineCardRefs.current.delete(memoryId);
  }

  function updateActiveMemoryFromViewport() {
    const viewport = timelineViewportRef.current;

    if (!viewport) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const viewportCenter = viewportRect.left + viewportRect.width / 2;

    let closestMemoryId: string | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const memory of sortedMemories) {
      const card = timelineCardRefs.current.get(memory.id);

      if (!card) {
        continue;
      }

      const cardRect = card.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const distance = Math.abs(cardCenter - viewportCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestMemoryId = memory.id;
      }
    }

    if (closestMemoryId) {
      setActiveMemoryId(closestMemoryId);
    }
  }

  const activeIndex = useMemo(() => {
    return sortedMemories.findIndex((m) => m.id === activeMemoryId);
  }, [sortedMemories, activeMemoryId]);

  function scrollToMemoryIndex(index: number) {
    const targetMemory = sortedMemories[index];
    if (!targetMemory) return;
    const targetCard = timelineCardRefs.current.get(targetMemory.id);
    if (targetCard) {
      targetCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  function handlePrev() {
    if (activeIndex > 0) {
      scrollToMemoryIndex(activeIndex - 1);
    }
  }

  function handleNext() {
    if (activeIndex >= 0 && activeIndex < sortedMemories.length - 1) {
      scrollToMemoryIndex(activeIndex + 1);
    }
  }

  function handleCenterScroll() {
    if (sortedMemories.length === 0) return;
    const middleIndex = Math.floor(sortedMemories.length / 2);
    scrollToMemoryIndex(middleIndex);
  }

  useLayoutEffect(() => {
    if (isLoading || hasInitializedTimelineRef.current || sortedMemories.length === 0) {
      return;
    }

    const viewport = timelineViewportRef.current;
    const middleIndex = Math.floor(sortedMemories.length / 2);
    const middleMemory = sortedMemories[middleIndex];
    const middleCard = middleMemory ? timelineCardRefs.current.get(middleMemory.id) : null;

    if (!viewport || !middleCard) {
      return;
    }

    middleCard.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
    hasInitializedTimelineRef.current = true;
  }, [isLoading, sortedMemories.length]);

  useEffect(() => {
    const viewport = timelineViewportRef.current;

    if (!viewport || sortedMemories.length === 0) {
      return;
    }

    function handleScroll() {
      if (scrollAnimationFrameRef.current !== null) {
        return;
      }

      scrollAnimationFrameRef.current = window.requestAnimationFrame(() => {
        scrollAnimationFrameRef.current = null;
        updateActiveMemoryFromViewport();
      });
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    updateActiveMemoryFromViewport();

    return () => {
      viewport.removeEventListener('scroll', handleScroll);

      if (scrollAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollAnimationFrameRef.current);
        scrollAnimationFrameRef.current = null;
      }
    };
  }, [sortedMemories]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setImagePreview(null);
      setImageName('');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setImagePreview(typeof reader.result === 'string' ? reader.result : null);
      setImageName(file.name);
    };

    reader.readAsDataURL(file);
  }

  function handleTimelineWheel(event: React.WheelEvent<HTMLDivElement>) {
    const viewport = timelineViewportRef.current;

    if (!viewport) {
      return;
    }

    const hasHorizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const nextDelta = hasHorizontalIntent ? event.deltaX : event.deltaY;

    if (nextDelta !== 0) {
      event.preventDefault();

      const currentMemoryIndex = sortedMemories.findIndex((memory) => memory.id === activeMemoryId);
      const nextMemoryIndex = nextDelta > 0 ? currentMemoryIndex + 1 : currentMemoryIndex - 1;
      const clampedIndex = Math.max(0, Math.min(sortedMemories.length - 1, nextMemoryIndex));
      const nextMemory = sortedMemories[clampedIndex];
      const nextCard = nextMemory ? timelineCardRefs.current.get(nextMemory.id) : null;

      if (nextCard) {
        nextCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }

  async function handleCreateMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!imagePreview) {
      setErrorMessage('Please add a picture before saving the memory.');
      return;
    }

    setErrorMessage(null);

    const createdMemory = await createMemory({
      title: formState.title,
      date: formState.date,
      description: formState.description,
      milestoneTag: formState.milestoneTag || undefined,
      imageUrl: imagePreview,
      imageAlt: imageName || 'Uploaded memory image'
    });

    if (createdMemory) {
      setMemories((currentMemories) => [...currentMemories, createdMemory]);
      setSelectedMemory(createdMemory);
      setIsComposerOpen(false);
      setImagePreview(null);
      setImageName('');
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
        <div className="hero__inner">
          <p className="eyebrow">Us Together</p>
          <h1>Polaroid memories, centered in time.</h1>
        </div>
      </section>

      <section className="composer" aria-label="add memory">
        <button className="composer__toggle" type="button" onClick={() => setIsComposerOpen((current) => !current)}>
          <span className="composer__plus">+</span>
          <span className="composer__label">{isComposerOpen ? 'Close' : 'Add'}</span>
        </button>
        {isComposerOpen ? (
          <form className="composer__form" onSubmit={handleCreateMemory}>
            <label className="composer__file">
              <span className="composer__file-button">Add picture</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                required
              />
            </label>
            <div className="composer__preview">
              {imagePreview ? <img src={imagePreview} alt={imageName || 'Selected upload preview'} /> : <span>No picture selected</span>}
            </div>
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
        ) : null}
        {errorMessage ? <p className="composer__error">{errorMessage}</p> : null}
      </section>

      <section className="timeline-stage" aria-label="memory timeline">
        {isLoading ? <p className="timeline-stage__status">Loading memories...</p> : null}

        {sortedMemories.length > 0 ? (
          <div className="timeline-nav-bar">
            <button
              type="button"
              className="timeline-nav-btn"
              onClick={handlePrev}
              disabled={activeIndex <= 0}
              aria-label="Previous Memory"
            >
              ‹
            </button>
            <button
              type="button"
              className="timeline-nav-center-btn"
              onClick={handleCenterScroll}
              title="Jump to Center Memory"
            >
              <span className="timeline-nav-dot" />
              <span>{activeIndex >= 0 ? `${activeIndex + 1} of ${sortedMemories.length}` : 'Center'}</span>
            </button>
            <button
              type="button"
              className="timeline-nav-btn"
              onClick={handleNext}
              disabled={activeIndex >= sortedMemories.length - 1}
              aria-label="Next Memory"
            >
              ›
            </button>
          </div>
        ) : null}

        <div className="timeline-stage__viewport" ref={timelineViewportRef} onWheel={handleTimelineWheel}>
          {sortedMemories.length > 0 ? (
            <div className="timeline-track">
              {sortedMemories.map((memory, index) => (
                <TimelineCard
                  key={memory.id}
                  memory={memory}
                  onOpen={setSelectedMemory}
                  isActive={memory.id === activeMemoryId}
                  setRef={(node) => setTimelineCardRef(memory.id, node)}
                  rotation={index % 2 === 0 ? -2 : 2}
                />
              ))}
            </div>
          ) : (
            <button className="timeline-empty-card" type="button" onClick={() => setIsComposerOpen(true)}>
              <span className="timeline-empty-card__photo">
                <span className="timeline-empty-card__plus">+</span>
              </span>
              <span className="timeline-empty-card__caption">
                <span className="timeline-empty-card__label">Tap to upload</span>
                <span className="timeline-empty-card__hint">Your first memory goes here</span>
              </span>
            </button>
          )}
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
