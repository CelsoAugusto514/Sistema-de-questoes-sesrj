import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_NAME, sessionUser } from '../lib/auth';
import StudyApp from './study-app';
export const dynamic='force-dynamic';
export default async function Home(){if(!sessionUser((await cookies()).get(COOKIE_NAME)?.value))redirect('/login');return <StudyApp/>;}
