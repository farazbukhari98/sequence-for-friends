import { AVATAR_ICONS, AVATAR_COLORS, getAvatarEmoji } from '../../lib/avatars';

interface AvatarPickerProps {
  selectedIcon: string;
  selectedColor: string;
  onSelectIcon: (id: string) => void;
  onSelectColor: (color: string) => void;
}

export function AvatarPicker({ selectedIcon, selectedColor, onSelectIcon, onSelectColor }: AvatarPickerProps) {
  return (
    <div className="avatar-picker">
      <div className="avatar-preview" style={{ backgroundColor: selectedColor }}>
        <span className="avatar-preview-emoji">{getAvatarEmoji(selectedIcon)}</span>
      </div>

      <div className="avatar-section">
        <label className="avatar-label">Icon</label>
        <div className="avatar-icon-grid">
          {AVATAR_ICONS.map((icon) => (
            <button
              key={icon.id}
              className={`avatar-icon-btn ${selectedIcon === icon.id ? 'active' : ''}`}
              onClick={() => onSelectIcon(icon.id)}
              style={selectedIcon === icon.id ? { borderColor: selectedColor } : undefined}
            >
              {icon.emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="avatar-section">
        <label className="avatar-label">Color</label>
        <div className="avatar-color-grid">
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              className={`avatar-color-btn ${selectedColor === color ? 'active' : ''}`}
              onClick={() => onSelectColor(color)}
              style={{ backgroundColor: color }}
            >
              {selectedColor === color && <span className="color-check">&#10003;</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
