import {
  DndContext, closestCenter, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Long-press (about 0.3s) a row, then drag it to any position. A quick swipe still scrolls the page.
const onlyVertical = ({ transform }) => ({ ...transform, x: 0 });

function Row({ id, index, children, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`no-callout ${isDragging ? "relative z-20 scale-[1.02] shadow-xl rounded-2xl opacity-95" : ""}`}
      {...(disabled ? {} : attributes)}
      {...(disabled ? {} : listeners)}
    >
      {children(index, isDragging)}
    </div>
  );
}

export default function SortableList({ ids, onReorder, children, className = "", disabled = false }) {
  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    if (from < 0 || to < 0) return;
    onReorder(active.id, over.id, arrayMove(ids, from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[onlyVertical]}
      onDragStart={() => navigator.vibrate?.(15)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {ids.map((id, index) => (
            <Row key={id} id={id} index={index} disabled={disabled}>
              {(i, dragging) => children(id, i, dragging)}
            </Row>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
