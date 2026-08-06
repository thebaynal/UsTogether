import { motion } from 'framer-motion';
import type { Memory } from '../types';

type Props = {
  memory: Memory;
  onOpen: (memory: Memory) => void;
  rotation: number;
  isActive: boolean;
  setRef: (node: HTMLButtonElement | null) => void;
};

export function TimelineCard({ memory, onOpen, rotation, isActive, setRef }: Props) {
  return (
    <motion.button
      ref={setRef}
      whileHover={{ y: -6, scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      animate={{ rotate: rotation, scale: isActive ? 1.08 : 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={isActive ? 'timeline-card timeline-card--active' : 'timeline-card'}
      aria-current={isActive ? 'true' : undefined}
      onClick={() => onOpen(memory)}
    >
      <div className="timeline-card__image-wrap">
        <img src={memory.imageUrl} alt={memory.imageAlt} className="timeline-card__image" loading="lazy" />
      </div>
      <div className="timeline-card__body">
        <span className="timeline-card__date">{new Date(memory.date).toLocaleDateString()}</span>
        <h3>{memory.title}</h3>
        {memory.milestoneTag ? <span className="timeline-card__tag">{memory.milestoneTag}</span> : null}
      </div>
    </motion.button>
  );
}
