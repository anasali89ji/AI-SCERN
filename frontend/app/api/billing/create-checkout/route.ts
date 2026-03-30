import { NextResponse } from 'next/server'
// Billing disabled — Aiscern is free and open source
export async function GET()  { return NextResponse.json({ error: 'Billing is disabled. Aiscern is free.' }, { status: 404 }) }
export async function POST() { return NextResponse.json({ error: 'Billing is disabled. Aiscern is free.' }, { status: 404 }) }
