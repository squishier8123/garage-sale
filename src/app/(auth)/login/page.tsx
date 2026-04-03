import { Suspense } from "react";
import { LoginForm } from "@/components/ui/LoginForm";

export const metadata = {
  title: "Sign In",
};

export default function LoginPage() {
  return (
    <div className="bg-white shadow rounded-lg p-8">
      <h1 className="text-xl font-bold text-gray-900 text-center mb-6">
        Sign in to your account
      </h1>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
