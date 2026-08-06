import { motion } from 'framer-motion';
import type { Memory } from '../types';

type Props = {
  memory: Memory;
  onOpen: (memory: Memory) => void;
  rotation: number;
};

export function TimelineCard({ memory, onOpen, rotation }: Props) {
  return (
    <motion.button
      whileHover={{ y: -6, rotate: rotation * 0.4 }}
      whileTap={{ scale: 0.98 }}
      className="timeline-card"
      style={{ transform: `rotate(${rotation}deg)` }}
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
