import { useState, useEffect } from 'react';
import {
  collection, query, where, getDocs,
  doc, updateDoc, Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

export function useQuotes(userId) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userId) loadQuotes();
  }, [userId]);

  const loadQuotes = async () => {
    setLoading(true);
    setError('');
    try {
      const q = query(collection(db, 'quotes'), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));

      // Sort newest first
      list.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.date);
        const dateB = b.createdAt?.toDate?.() || new Date(b.date);
        return dateB - dateA;
      });

      setQuotes(list);
    } catch (err) {
      console.error('Error loading quotes:', err);
      setError('Could not load quotes. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const updateQuoteStatus = async (quoteId, newStatus, extraData = {}) => {
    try {
      await updateDoc(doc(db, 'quotes', quoteId), {
        status: newStatus,
        ...extraData,
        updatedAt: Timestamp.now(),
      });
      setQuotes(prev =>
        prev.map(q => q.id === quoteId ? { ...q, status: newStatus, ...extraData } : q)
      );
      return { success: true };
    } catch (err) {
      console.error('Error updating quote status:', err);
      return { success: false, error: err.message };
    }
  };

  return { quotes, loading, error, refreshQuotes: loadQuotes, updateQuoteStatus, setQuotes };
}
