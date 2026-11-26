import React from 'react';
import { MapPinOff } from 'lucide-react';

/**
 * The "out of range" pop-up text students see when the attendance device says their phone is
 * too far away. One message per session, or one per phase for two-phase sessions. Empty = the
 * app's default text.
 */
export const OUT_OF_RANGE_MAX = 500;
export const DEFAULT_OUT_OF_RANGE_TEXT =
  'Your phone is too far from the attendance device, so attendance was not marked. Move closer to the device and tap Mark again.';

interface Props {
  twoPhase: boolean;
  message: string;
  onMessageChange: (value: string) => void;
  messagePhase2: string;
  onMessagePhase2Change: (value: string) => void;
}

const boxStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '64px',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  fontFamily: 'inherit',
  resize: 'vertical',
  boxSizing: 'border-box'
};

function Field({ label, value, onChange, accent }: { label: string; value: string; onChange: (v: string) => void; accent: string }) {
  return (
    <div>
      <label style={{ fontSize: '11px', fontWeight: 700, color: accent, display: 'block', marginBottom: '4px' }}>{label}</label>
      <textarea
        value={value}
        maxLength={OUT_OF_RANGE_MAX}
        onChange={(e) => onChange(e.target.value)}
        placeholder={DEFAULT_OUT_OF_RANGE_TEXT}
        style={boxStyle}
      />
      <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'right' }}>{value.length}/{OUT_OF_RANGE_MAX}</div>
    </div>
  );
}

export const OutOfRangeMessageFields: React.FC<Props> = ({ twoPhase, message, onMessageChange, messagePhase2, onMessagePhase2Change }) => (
  <div style={{ border: '1px solid #fecaca', backgroundColor: '#fff7f7', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: '#991b1b' }}>
      <MapPinOff size={15} /> "Out of range" pop-up message
    </div>
    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '-6px' }}>
      Shown to a student whose phone is too far from the attendance device. Leave empty to use the default text.
    </div>
    <Field
      label={twoPhase ? '1st Attendance message' : 'Message'}
      value={message}
      onChange={onMessageChange}
      accent="#334155"
    />
    {twoPhase && (
      <Field label="2nd Attendance message" value={messagePhase2} onChange={onMessagePhase2Change} accent="#6b21a8" />
    )}
  </div>
);

export default OutOfRangeMessageFields;
