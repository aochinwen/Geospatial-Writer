import { login } from './actions'
import { SignUpModal } from '@/components/SignUpModal'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-neutral-100 dark:bg-neutral-900">
            <Card className="w-[350px]">
                <CardHeader>
                    <CardTitle>Geospatial Writer</CardTitle>
                    <CardDescription>Sign in to access your maps.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form>
                        <div className="grid w-full items-center gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" placeholder="name@example.com" required />
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="password">Password</Label>
                                <Input id="password" name="password" type="password" required />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 mt-6">
                            <Button formAction={login} className="w-full">Log in</Button>
                            <SignUpModal />
                        </div>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center text-xs text-muted-foreground mt-2">
                    Use the credentials provided by your admin or sign up.
                </CardFooter>
            </Card>
        </div>
    )
}
