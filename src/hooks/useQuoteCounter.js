import { useState, useEffect } from 'react';
import {
  doc, getDoc, setDoc, collection, query, where,
  getDocs, runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';
import clientConfig from '../config/client';

export function useQuoteCounter(userId) {
  const [quoteNumber, setQuoteNumber] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) initialize();
  }, [userId]);

  // On first load: if counter doc doesn't exist, scan quotes to find highest number
  const initialize = async () => {
    setLoading(true);
    try {
      const counterRef = doc(db, 'counters', 'quotes');
      const counterDoc = await getDoc(counterRef);

      if (!counterDoc.exists()) {
        const q = query(collection(db, 'quotes'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        let highest = 0;
        snapshot.forEach(d => {
          const match = d.data().quoteNumber?.match(/[A-Z]+-Q-\d{4}-(\d{4})/);
          if (match) {
            const num = parseInt(match[1]);
            if (num > highest) highest = num;
          }
        });
        await setDoc(counterRef, { count: highest });
      }

      const current = (await getDoc(counterRef)).data().count;
      const year = new Date().getFullYear();
      const prefix = clientConfig.invoicePrefix || 'TFS';
      setQuoteNumber(`${prefix}-Q-${year}-${(current + 1).toString().padStart(4, '0')}`);
    } catch (err) {
      console.error('Error initializing quote counter:', err);
      setQuoteNumber(`TFS-Q-${new Date().getFullYear()}-XXXX`);
    } finally {
      setLoading(false);
    }
  };

  // Called AFTER a successful send — atomically increments counter and returns the number used
  const consumeNumber = async () => {
    const counterRef = doc(db, 'counters', 'quotes');
    let usedNumber = '';

    await runTransaction(db, async (t) => {
      const counterDoc = await t.get(counterRef);
      const count = (counterDoc.exists() ? counterDoc.data().count : 0) + 1;
      t.set(counterRef, { count });
      const year = new Date().getFullYear();
      const prefix = clientConfig.invoicePrefix || 'TFS';
      usedNumber = `${prefix}-Q-${year}-${count.toString().padStart(4, '0')}`;
    });

    // Show the NEXT number after the one just used
    const counterDoc = await getDoc(counterRef);
    const newCount = counterDoc.data().count;
    const year = new Date().getFullYear();
    const prefix = clientConfig.invoicePrefix || 'TFS';
    setQuoteNumber(`${prefix}-Q-${year}-${(newCount + 1).toString().padStart(4, '0')}`);

    return usedNumber;
  };

  return { quoteNumber, loading, consumeNumber };
}
