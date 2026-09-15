import { ModalHost } from '../ModalHost';
import { usePresenceClose } from '../usePresenceClose';

interface Props { gemId: string | null; onClose: () => void; }
export function TimerRewardOverlay({ gemId, onClose }: Props) {
  const { closing, requestClose } = usePresenceClose(onClose);
  if (!gemId) return null;
  return <ModalHost onClose={requestClose}><section className="timer-reward" data-motion-state={closing ? 'closing' : 'open'} role="dialog" aria-modal="true" aria-labelledby="timer-reward-title"><div className="timer-reward__content">
    <span className="timer-reward__eyebrow">FOCUS MILESTONE</span><h2 id="timer-reward-title">A new amethyst</h2><p>You showed up for your focus. This gem is now part of your collection.</p>
    <img src="/gems/amethyst-star.png" alt="Newly unlocked amethyst reward" /><button type="button" onClick={requestClose}>Continue</button>
  </div></section></ModalHost>;
}
