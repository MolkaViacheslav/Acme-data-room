import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface AuthCardProps {
  readonly title: string;
  readonly description: string;
  readonly footerPrompt: string;
  readonly footerLinkLabel: string;
  readonly footerHref: string;
  readonly children: React.ReactNode;
}

export function AuthCard({
  title,
  description,
  footerPrompt,
  footerLinkLabel,
  footerHref,
  children,
}: AuthCardProps) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent>{children}</CardContent>

      <CardFooter className="justify-center">
        <p className="text-muted-foreground text-sm">
          {footerPrompt}{' '}
          <Link href={footerHref} className="text-foreground font-medium underline underline-offset-4">
            {footerLinkLabel}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
