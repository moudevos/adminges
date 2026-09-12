"use client";

import { faArrowRightToBracket, faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import Swal from "sweetalert2";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Ingresa un correo válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

type LoginInput = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      await Swal.fire({
        icon: "error",
        title: "No se pudo iniciar sesión",
        text: "Verifica tus credenciales e inténtalo nuevamente.",
        confirmButtonText: "Aceptar",
      });
      return;
    }

    const next = searchParams.get("next");
    const destination = next?.startsWith("/") ? next : "/dashboard";

    router.replace(destination);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="usuario@empresa.com"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
          {...register("email")}
        />
        {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
          Contraseña
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
            {...register("password")}
          />
          <button
            type="button"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 hover:text-slate-900"
          >
            <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
          </button>
        </div>
        {errors.password && <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FontAwesomeIcon icon={faArrowRightToBracket} />
        {isSubmitting ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
