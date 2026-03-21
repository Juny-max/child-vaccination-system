'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { changePassword } from '@/lib/api/auth';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Password requirements
  const requirements = [
    { label: 'At least 8 characters', met: newPassword.length >= 8 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(newPassword) },
    { label: 'Contains lowercase letter', met: /[a-z]/.test(newPassword) },
    { label: 'Contains a number', met: /[0-9]/.test(newPassword) },
  ];

  const allRequirementsMet = requirements.every((req) => req.met);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!allRequirementsMet) {
      setError('Please meet all password requirements');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await changePassword({
        currentPassword,
        newPassword,
      });

      if (response.success) {
        // Clear the must change password flag
        localStorage.removeItem('mustChangePassword');
        
        // Redirect to appropriate dashboard based on role
        const role = localStorage.getItem('userRole');
        switch (role) {
          case 'parent':
            router.push('/parent/dashboard');
            break;
          case 'facility_nurse':
            router.push('/facility/dashboard');
            break;
          case 'chw':
            router.push('/chw/dashboard');
            break;
          default:
            router.push('/dashboard');
        }
      } else {
        setError(response.message || 'Failed to change password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Change password error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-cyan-50 via-white to-emerald-50">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-16 h-72 w-72 rounded-full bg-cyan-300/35 blur-3xl" />
        <div className="absolute -right-24 top-1/4 h-80 w-80 rounded-full bg-emerald-300/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#0f766e_1px,transparent_1px),linear-gradient(90deg,#0f766e_1px,transparent_1px)] [background-size:28px_28px]" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4 md:p-6">
      <Card className="w-full max-w-md border-white/70 bg-white/90 shadow-2xl backdrop-blur-sm">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-cyan-100 p-3 ring-8 ring-white/70">
              <Lock className="h-6 w-6 text-cyan-700" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Change Your Password
          </CardTitle>
          <CardDescription className="text-center">
            For security reasons, you must change your temporary password before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your temporary password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter your new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Password Requirements:</p>
              <ul className="space-y-1">
                {requirements.map((req, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    {req.met ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-300" />
                    )}
                    <span className={req.met ? 'text-green-700' : 'text-gray-500'}>
                      {req.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-sm text-red-500">Passwords do not match</p>
              )}
              {passwordsMatch && (
                <p className="text-sm text-green-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Passwords match
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !allRequirementsMet || !passwordsMatch}
            >
              {isLoading ? 'Changing Password...' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
