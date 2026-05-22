"use client";

import { useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";
import { Task, TimeBucket, BalanceCategory } from "@/lib/types";

export function useTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setTasks(data as Task[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const createTask = async (
    title: string,
    timeBucket: TimeBucket = "today",
    balanceCategory: BalanceCategory = "work"
  ) => {
    if (!user) return;
    const now = new Date().toISOString();
    const task: Task = {
      id: uuidv4(),
      user_id: user.id,
      title,
      notes: "",
      status: "active",
      time_bucket: timeBucket,
      balance_category: balanceCategory,
      created_at: now,
      completed_at: null,
      updated_at: now,
    };
    setTasks((prev) => [task, ...prev]);
    await supabase.from("tasks").insert(task);
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const updatedAt = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, ...updates, updated_at: updatedAt } : t
      )
    );
    await supabase
      .from("tasks")
      .update({ ...updates, updated_at: updatedAt })
      .eq("id", id);
  };

  const completeTask = async (id: string, completedAt?: string) => {
    const timestamp = completedAt || new Date().toISOString();
    await updateTask(id, { status: "done", completed_at: timestamp });
  };

  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  };

  const activeTasks = tasks.filter((t) => t.status === "active");
  const completedTasks = tasks.filter((t) => t.status === "done");

  return {
    tasks,
    activeTasks,
    completedTasks,
    loading,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    refetch: fetchTasks,
  };
}
