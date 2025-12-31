
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import MapComponent from '@/components/Map'
import { ProjectProvider } from '@/context/ProjectContext'
import { TemplateProvider } from '@/context/TemplateContext'

export default async function Home() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    return (
        <TemplateProvider user={user}>
            <ProjectProvider initialUser={user}>
                <main className="flex h-screen w-screen flex-col items-center justify-between overflow-hidden">
                    <MapComponent />
                </main>
            </ProjectProvider>
        </TemplateProvider>
    )
}

