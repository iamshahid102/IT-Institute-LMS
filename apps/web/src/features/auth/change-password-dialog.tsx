'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { apiFetch, formatApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(10, 'Use at least 10 characters.')
      .regex(/[A-Za-z]/, 'Include at least one letter.')
      .regex(/\d/, 'Include at least one number.'),
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

type FormValues = z.infer<typeof schema>;

export function ChangePasswordDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await apiFetch('/auth/change-password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      toast.success('Password updated. Other sessions were signed out.');
      form.reset();
      setOpen(false);
    } catch (submitError) {
      setError(formatApiError(submitError));
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Choose a strong password. All other sessions will be signed out.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormErrorSummary message={error} />
          <FormField label="Current password" htmlFor="currentPassword" error={form.formState.errors.currentPassword?.message} required>
            <Input id="currentPassword" type="password" autoComplete="current-password" {...form.register('currentPassword')} />
          </FormField>
          <FormField
            label="New password"
            htmlFor="newPassword"
            error={form.formState.errors.newPassword?.message}
            hint="At least 10 characters with a letter and a number."
            required
          >
            <Input id="newPassword" type="password" autoComplete="new-password" {...form.register('newPassword')} />
          </FormField>
          <FormField label="Confirm new password" htmlFor="confirmPassword" error={form.formState.errors.confirmPassword?.message} required>
            <Input id="confirmPassword" type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Saving…' : 'Update password'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
