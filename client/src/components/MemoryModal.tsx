import { AnimatePresence, motion } from 'framer-motion';
import type { Memory } from '../types';

type Props = {
  memory: Memory | null;
  onClose: () => void;
  onDelete: (memoryId: string) => void;
};

export function MemoryModal({ memory, onClose, onDelete }: Props) {
  return (
    <AnimatePresence>
      {memory ? (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="modal"
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            onClick={(event) => event.stopPropagation()}
          >
            <img src={memory.imageUrl} alt={memory.imageAlt} className="modal__image" />
            <div className="modal__content">
              <div className="modal__meta">
                <span>{new Date(memory.date).toLocaleDateString()}</span>
                {memory.milestoneTag ? <span>{memory.milestoneTag}</span> : null}
              </div>
              <h2>{memory.title}</h2>
              <p>{memory.description}</p>
              <div className="modal__actions">
                <button className="button button--ghost" onClick={onClose}>Close</button>
                <button className="button button--danger" onClick={() => onDelete(memory.id)}>Delete</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
