import { FormEvent, useState } from 'react';
import { submitInquiry } from '../api/client';

type State = 'idle' | 'sending' | 'success' | 'error';

export function ContactForm() {
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('sending');
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries()) as any;
    try {
      await submitInquiry(payload);
      setState('success');
      setMessage('Thank you. Your enquiry has been received.');
      e.currentTarget.reset();
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Please try again.');
    }
  }

  return (
    <form className="inquiry-form" onSubmit={submit}>
      <div className="form-title"><span>✦</span><div><b>Send an enquiry</b><small>All fields marked * are required</small></div></div>
      <label>Full name *<input name="name" required minLength={2} maxLength={100} autoComplete="name" /></label>
      <label>Email address *<input name="email" type="email" required maxLength={160} autoComplete="email" /></label>
      <label>What do you need help with? *
        <select name="category" required>
          <option value="general">General support</option>
          <option value="technical">Technical issue</option>
          <option value="organisation">Business or institution</option>
          <option value="partnership">Partnership or media</option>
          <option value="privacy">Privacy request</option>
        </select>
      </label>
      <label>Your message *<textarea name="message" required minLength={10} maxLength={3000} rows={6} /></label>
      <button className="button" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send enquiry →'}</button>
      <p className={`form-status ${state}`} aria-live="polite">{message}</p>
      <small className="form-safe">Do not include passwords, OTPs, PINs or private contact data.</small>
    </form>
  );
}
