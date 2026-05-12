export default function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onMouseDown={onClose}
    >
      {/* Stop propagation so clicks inside the modal don't close it */}
      <div className="w-full flex justify-center" onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
