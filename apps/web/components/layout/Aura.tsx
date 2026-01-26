'use client'

export function Aura() {
    return (
        <div className="aura-bg">
            {/* Top Left Blob - High Performance CSS Animation */}
            <div
                className="aura-blob top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[hsl(var(--aura-1))] animate-aura-float-1"
                style={{ willChange: 'transform, opacity' }}
            />

            {/* Bottom Right Blob - High Performance CSS Animation */}
            <div
                className="aura-blob bottom-[-15%] right-[-10%] w-[60%] h-[60%] bg-[hsl(var(--aura-2))] animate-aura-float-2"
                style={{ willChange: 'transform, opacity' }}
            />

            {/* Optimization Overlay: Hardware-accelerated Noise Layer */}
            <div
                className="fixed inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay invert dark:invert-0"
                style={{
                    backgroundImage: "url('https://grain-y.vercel.app/noise.svg')",
                    willChange: 'opacity'
                }}
            />

            <style jsx>{`
                @keyframes aura-float-1 {
                    0% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(30px, 20px) scale(1.05); }
                    66% { transform: translate(-20px, 40px) scale(0.95); }
                    100% { transform: translate(0, 0) scale(1); }
                }
                @keyframes aura-float-2 {
                    0% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(-40px, -20px) scale(1.1); }
                    66% { transform: translate(20px, -50px) scale(0.9); }
                    100% { transform: translate(0, 0) scale(1); }
                }
                .animate-aura-float-1 {
                    animation: aura-float-1 25s ease-in-out infinite;
                }
                .animate-aura-float-2 {
                    animation: aura-float-2 30s ease-in-out infinite;
                }
            `}</style>
        </div>
    )
}
