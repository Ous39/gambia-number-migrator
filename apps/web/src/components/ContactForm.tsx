import { FormEvent, useState } from 'react';
import { submitInquiry } from '../api/client';

type State = 'idle' | 'sending' | 'success' | 'error';

export function ContactForm() {
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Capture the form element now — e.currentTarget is null after the await.
    const formEl = e.currentTarget;
    setState('sending');
    const payload = Object.fromEntries(new FormData(formEl).entries()) as any;
    try {
      await submitInquiry(payload);
      setState('success');
      setMessage('Thank you. Your enquiry has been received.');
      formEl.reset();
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Please try again.');
    }
  }

  return (
    <form className="form card pad-lg" onSubmit={submit}>
      <label>Full name *<input name="name" required minLength={2} maxLength={100} autoComplete="name" /></label>
      <label>Email address *<input name="email" type="email" required maxLength={160} autoComplete="email" /></label>
      <label>What do you need help with? *
        <select name="category" required defaultValue="general">
          <option value="general">General support</option>
          <option value="technical">Technical issue</option>
          <option value="organisation">Business or institution</option>
          <option value="partnership">Partnership or media</option>
          <option value="privacy">Privacy request</option>
        </select>
      </label>
      <label>Your message *<textarea name="message" required minLength={10} maxLength={3000} rows={6} /></label>
      <button className="btn" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send enquiry →'}</button>
      {message && <p className={`form-status ${state}`} aria-live="polite">{message}</p>}
      <small className="form-hint">Fields marked * are required. Do not include passwords, OTPs, PINs or private contact data.</small>
    </form>
  );
}
