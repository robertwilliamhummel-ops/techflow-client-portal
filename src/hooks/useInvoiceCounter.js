import { useState, useEffect } from 'react';
import {
  doc, getDoc, setDoc, collection, query, where,
  getDocs, runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';
import clientConfig from '../config/client';

export function useInvoiceCounter(userId) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) initialize();
  }, [userId]);

  // On first load: if counter doc doesn't exist, scan invoices to find highest number
  // This handles migration from the old localStorage-based counter
  const initialize = async () => {
    setLoading(true);
    try {
      const counterRef = doc(db, 'counters', 'invoices');
      const counterDoc = await getDoc(counterRef);

      if (!counterDoc.exists()) {
        // Scan existing invoices to find highest number
        const q = query(collection(db, 'invoices'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        let highest = 0;
        snapshot.forEach(d => {
          const match = d.data().number?.match(/[A-Z]+-\d{4}-(\d{4})/);
          if (match) {
            const num = parseInt(match[1]);
            if (num > highest) highest = num;
          }
        });
        // Initialize counter at highest found number
        await setDoc(counterRef, { count: highest });
      }

      // Show the NEXT number to use (current count + 1) without incrementing yet
      const current = (await getDoc(counterRef)).data().count;
      const year = new Date().getFullYear();
      const prefix = clientConfig.invoicePrefix || 'TFS';
      setInvoiceNumber(`${prefix}-${year}-${(current + 1).toString().padStart(4, '0')}`);
    } catch (err) {
      console.error('Error initializing invoice counter:', err);
      // Fallback: timestamp-based number
      setInvoiceNumber(`TFS-${new Date().getFullYear()}-XXXX`);
    } finally {
      setLoading(false);
    }
  };

  // Called AFTER a successful send — atomically increments counter and returns the number
  // that was just used, then prepares the next number for display
  const consumeNumber = async () => {
    const counterRef = doc(db, 'counters', 'invoices');
    let usedNumber = '';

    await runTransaction(db, async (t) => {
      const counterDoc = await t.get(counterRef);
      const count = (counterDoc.exists() ? counterDoc.data().count : 0) + 1;
      t.set(counterRef, { count });
      const year = new Date().getFullYear();
      const prefix = clientConfig.invoicePrefix || 'TFS';
      usedNumber = `${prefix}-${year}-${count.toString().padStart(4, '0')}`;
    });

    // Now show the NEXT number after the one we just used
    const counterDoc = await getDoc(counterRef);
    const newCount = counterDoc.data().count;
    const year = new Date().getFullYear();
    const prefix = clientConfig.invoicePrefix || 'TFS';
    setInvoiceNumber(`${prefix}-${year}-${(newCount + 1).toString().padStart(4, '0')}`);

    return usedNumber;
  };

  return { invoiceNumber, loading, consumeNumber };
}
