import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    template: "%s | VF ERP",
    default: "VF ERP System",
  },
  description: "vosFoyer Internal CRM + BizDev Pipeline Tool",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" className={`${inter.variable} h-full`}>
      <body className="h-full bg-white antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
