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
  const formattedDate = new Date(memory.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <motion.button
      ref={setRef}
      whileHover={{ y: -8, scale: 1.04, rotate: rotation > 0 ? rotation + 1 : rotation - 1 }}
      whileTap={{ scale: 0.97 }}
      animate={{ rotate: rotation, scale: isActive ? 1.08 : 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      className={isActive ? 'timeline-card timeline-card--active' : 'timeline-card'}
      aria-current={isActive ? 'true' : undefined}
      onClick={() => onOpen(memory)}
    >
      <div className="polaroid-tape" />
      <div className="timeline-card__image-wrap">
        <img src={memory.imageUrl} alt={memory.imageAlt} className="timeline-card__image" loading="lazy" />
      </div>
      <div className="timeline-card__body">
        <h3 className="polaroid-caption">{memory.title}</h3>
        <div className="timeline-card__footer">
          <span className="timeline-card__date">{formattedDate}</span>
          {memory.milestoneTag ? <span className="timeline-card__tag">{memory.milestoneTag}</span> : null}
        </div>
      </div>
    </motion.button>
  );
}
