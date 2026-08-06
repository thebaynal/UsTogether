import { AnimatePresence, motion } from 'framer-motion';
import type { Memory } from '../types';

type Props = {
  memory: Memory | null;
  onClose: () => void;
  onDelete: (memoryId: string) => void;
};

export function MemoryModal({ memory, onClose, onDelete }: Props) {
  if (!memory) return null;

  const formattedDate = new Date(memory.date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <AnimatePresence>
      <motion.div
        className="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal modal--polaroid"
          initial={{ y: 32, opacity: 0, scale: 0.94, rotate: -1.5 }}
          animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
          exit={{ y: 32, opacity: 0, scale: 0.94, rotate: 1.5 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="polaroid-tape modal-tape" />
          
          <div className="modal__photo-container">
            <img src={memory.imageUrl} alt={memory.imageAlt} className="modal__image" />
          </div>

          <div className="modal__content">
            <h2 className="modal__title">{memory.title}</h2>
            
            <div className="modal__meta">
              <span className="modal__date">{formattedDate}</span>
              {memory.milestoneTag ? <span className="modal__tag">{memory.milestoneTag}</span> : null}
            </div>

            <p className="modal__description">{memory.description}</p>

            <div className="modal__actions">
              <button type="button" className="button button--ghost" onClick={onClose}>
                Close
              </button>
              <button type="button" className="button button--danger" onClick={() => onDelete(memory.id)}>
                Delete Memory
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
