import { useState, useEffect } from 'react';
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, deleteDoc, doc, Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

export function useCustomers(userId) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) loadCustomers();
  }, [userId]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'customers'),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));

      // Sort alphabetically by name — matches customer.js
      list.sort((a, b) => a.name.localeCompare(b.name));
      setCustomers(list);
    } catch (err) {
      console.error('Error loading customers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Upsert by phone number — matches customer.js saveCustomer()
  const saveCustomer = async (customerData) => {
    if (!customerData.name?.trim() || !customerData.phone?.trim()) {
      return { success: false, error: 'Name and phone are required' };
    }

    try {
      const existing = customers.find(c => c.phone === customerData.phone);

      if (existing) {
        // Update existing
        await updateDoc(doc(db, 'customers', existing.id), {
          ...customerData,
          updatedAt: Timestamp.now(),
        });
        setCustomers(prev =>
          prev.map(c => c.id === existing.id ? { ...c, ...customerData } : c)
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        return { success: true, id: existing.id, updated: true };
      } else {
        // Add new
        const docRef = await addDoc(collection(db, 'customers'), {
          ...customerData,
          userId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        const newCustomer = { id: docRef.id, ...customerData, userId };
        setCustomers(prev =>
          [...prev, newCustomer].sort((a, b) => a.name.localeCompare(b.name))
        );
        return { success: true, id: docRef.id, updated: false };
      }
    } catch (err) {
      console.error('Error saving customer:', err);
      return { success: false, error: err.message };
    }
  };

  const deleteCustomer = async (customerId) => {
    try {
      await deleteDoc(doc(db, 'customers', customerId));
      setCustomers(prev => prev.filter(c => c.id !== customerId));
      return { success: true };
    } catch (err) {
      console.error('Error deleting customer:', err);
      return { success: false, error: err.message };
    }
  };

  return { customers, loading, saveCustomer, deleteCustomer, refreshCustomers: loadCustomers };
}
