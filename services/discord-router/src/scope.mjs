// Which Discord channels the seat answers in, and what hat it wears there.
// Home (#chief-of-staff) and its threads: the Chief of Staff seat.
// Interviews (#interviews) and its threads: the Interview Coach (lost in the
// Hermes cutover of 2026-10-20; Bilal asked for it back on 2026-10-21).
// A thread inherits its parent's kind. Anything else is ignored.

/** @param {{id:string, parentId?:string|null, isThread?:() => boolean}} channel */
export function scopeFor(channel, { home, interviews = null }) {
  const kinds = [[home, 'home'], [interviews, 'interviews']].filter(([id]) => id);
  const isThread = typeof channel.isThread === 'function' && channel.isThread();
  for (const [id, kind] of kinds) {
    if (channel.id === id) return { channelId: id, threadId: null, kind };
    if (isThread && channel.parentId === id) return { channelId: id, threadId: channel.id, kind };
  }
  return null;
}
