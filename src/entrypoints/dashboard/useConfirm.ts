import { useEffect, useState } from 'react';

const CONFIRM_MS = 3000;

// Two-click confirmation: the first click arms, a second click within a few seconds runs `action`
export function useConfirm(action: () => void): { armed: boolean; onClick: () => void } {
    const [armed, setArmed] = useState(false);

    useEffect(() => {
        if (!armed) return;
        const timer = setTimeout(() => setArmed(false), CONFIRM_MS);
        return () => clearTimeout(timer);
    }, [armed]);

    const onClick = () => {
        if (!armed) {
            setArmed(true);
            return;
        }
        setArmed(false);
        action();
    };
    return { armed, onClick };
}
