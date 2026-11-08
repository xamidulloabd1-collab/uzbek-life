// src/components/HUD.tsx

import React from 'react';
import { useGameStore } from '../store/gameStore';

export const HUD: React.FC = () => {
  const { money, bankAccount, job, salary, hunger, energy, currentVehicle } = useGameStore();

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ').format(amount) + " so'm";
  };

  return (
    <div className="absolute top-0 left-0 w-full p-4 pointer-events-none flex justify-between items-start text-white font-sans select-none">
      {/* Chap tomon: Moliyaviy holat va Ish */}
      <div className="bg-black/60 backdrop-blur-md p-4 rounded-xl border border-white/10 pointer-events-auto space-y-2 shadow-lg min-w-[220px]">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Naqd pul:</span>
          <span className="font-bold text-green-400">{formatMoney(money)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Plastik karta:</span>
          <span className="font-semibold text-blue-300">{formatMoney(bankAccount)}</span>
        </div>
        <div className="border-t border-white/10 pt-2 mt-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Kasb:</span>
            <span className="text-yellow-400">{job ? job : 'Ishsiz'}</span>
          </div>
          {salary > 0 && (
            <div className="flex justify-between items-center text-xs text-gray-400 mt-1">
              <span>Maosh:</span>
              <span>{formatMoney(salary)} / kun</span>
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm px-6 py-2 rounded-full border border-white/10 text-center">
        <h1 className="text-lg font-extrabold tracking-wider bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
          UZBEK LIFE : G'UZOR
        </h1>
        <span className="text-xs text-gray-300">Mashina: {currentVehicle ? currentVehicle.toUpperCase() : 'Yo\'q'}</span>
      </div>

      {/* O'ng tomon: O'yinchi ehtiyojlari (Qorin ochishi va Energiya) */}
      <div className="bg-black/60 backdrop-blur-md p-4 rounded-xl border border-white/10 pointer-events-auto space-y-3 shadow-lg w-48">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-300">Qorin ochligi</span>
            <span className="text-orange-400">{Math.round(hunger)}%</span>
          </div>
          <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-orange-500 h-full transition-all duration-300" 
              style={{ width: `${hunger}%` }}
            ></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-300">Energiya</span>
            <span className="text-cyan-400">{Math.round(energy)}%</span>
          </div>
          <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-cyan-400 h-full transition-all duration-300" 
              style={{ width: `${energy}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};