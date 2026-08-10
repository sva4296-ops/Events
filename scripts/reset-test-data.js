#!/usr/bin/env node
/**
 * Dev/test-only: wipes every event and everything under it (guests, schedule,
 * venue, moments, reactions, messages, fund, contributions, photos) from the
 * connected Supabase project. Does NOT touch public.users or auth.users.
 *
 * This is NOT scoped to "your" test data — it truncates the whole `events`
 * table for the connected project. There is no separate staging/prod split in
 * this app, so make sure you're pointed at the project you actually mean to
 * wipe (the URL is printed before the confirmation prompt).
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (never EXPO_PUBLIC_-prefixed
 * — this key bypasses RLS entirely). Run: npm run reset-test-data
 * Skip the confirmation prompt with --yes / -y.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = {};
  if (!fs.existsSync(envPath)) return env;

  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const env = loadEnvLocal();
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.\n' +
        'Add the service role key from Supabase → Settings → API → service_role (secret).\n' +
        'See .env.example.',
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { count, error: countError } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Could not read the events table:', countError.message);
    process.exitCode = 1;
    return;
  }

  console.log(`Target project: ${url}`);
  console.log(
    `About to permanently delete ${count ?? 0} event(s) and everything under them ` +
      '(guests, schedule, venue, moments, reactions, messages, fund, contributions, photos).',
  );
  console.log('public.users and auth.users are NOT touched. This cannot be undone.');

  const skipPrompt = process.argv.includes('--yes') || process.argv.includes('-y');
  if (!skipPrompt) {
    const answer = await confirm('Type RESET to continue, anything else to cancel: ');
    if (answer !== 'RESET') {
      console.log('Cancelled — nothing was deleted.');
      return;
    }
  }

  const { error } = await supabase.rpc('reset_test_data');
  if (error) {
    console.error('Reset failed:', error.message);
    process.exitCode = 1;
    return;
  }

  console.log('Done — all event data cleared.');
}

void main();
