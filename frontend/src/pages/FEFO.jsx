import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listBatches } from "../api/batches";
import { listFoodItems } from "../api/food";
import StatusBadge from "../components/StatusBadge";
import { friendlyError } from "../utils/errors";

export default function FEFO() {
  const [batches, setBatches] = useState([]);
  const [foodItems, setFoodItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [batchRes, foodRes] = await Promise.all([
          listBatches({
            page: 1,
            page_size: 100,
          }),
          listFoodItems({
            page_size: 100,
          }),
        ]);

        setBatches(batchRes.items || batchRes || []);
        setFoodItems(foodRes.items || foodRes || []);
      } catch (err) {
        setError(
          friendlyError(
            err,
            "Could not load FEFO inventory data."
          )
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const foodItemMap = useMemo(() => {
    const map = {};

    foodItems.forEach((food) => {
      map[food.id] = food;
    });

    return map;
  }, [foodItems]);

  /*
   * FEFO:
   * First Expire, First Out.
   *
   * Only active batches are included.
   * Out-of-stock and expired batches are excluded
   * because they should not be recommended for use.
   */
  const fefoBatches = useMemo(() => {
    const activeBatches = batches.filter(
      (batch) =>
        batch.status !== "expired" &&
        batch.status !== "out_of_stock" &&
        Number(batch.quantity) > 0 &&
        batch.expiry_date
    );

    return [...activeBatches].sort((a, b) => {
      return (
        new Date(a.expiry_date) -
        new Date(b.expiry_date)
      );
    });
  }, [batches]);

  const priorityBatch = fefoBatches[0] || null;

  function getDaysRemaining(expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);

    const difference =
      expiry.getTime() - today.getTime();

    return Math.ceil(
      difference / (1000 * 60 * 60 * 24)
    );
  }

  function getPriorityStyle(index, daysRemaining) {
    if (daysRemaining <= 2) {
      return "bg-red-50 text-red-700";
    }

    if (daysRemaining <= 5) {
      return "bg-amber-50 text-amber-700";
    }

    if (index < 3) {
      return "bg-yellow-50 text-yellow-700";
    }

    return "bg-brand-50 text-brand-700";
  }

  function getPriorityLabel(index, daysRemaining) {
    if (daysRemaining <= 2) {
      return "Urgent";
    }

    if (daysRemaining <= 5) {
      return "High";
    }

    if (index < 3) {
      return "Medium";
    }

    return "Normal";
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          FEFO Inventory Rotation
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          First Expire, First Out — prioritize batches
          with the earliest expiry dates.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Recommended batch */}
      {!loading && priorityBatch && (
        <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                Recommended Batch to Use First
              </p>

              <h3 className="mt-1 text-xl font-bold text-slate-900">
                {foodItemMap[
                  priorityBatch.food_item_id
                ]?.name || "Food Item"}
              </h3>

              <p className="mt-1 text-sm text-slate-600">
                Batch: {priorityBatch.batch_code}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-500">
                Expiry
              </p>

              <p className="text-lg font-semibold text-slate-900">
                {priorityBatch.expiry_date}
              </p>

              <p className="mt-1 text-sm font-medium text-brand-700">
                {getDaysRemaining(
                  priorityBatch.expiry_date
                )}{" "}
                days remaining
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-white/70 px-4 py-3 text-sm text-slate-600">
            <strong>Why this batch?</strong> It has the
            earliest expiry date among the currently
            available batches.
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Active Batches
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {loading ? "—" : fefoBatches.length}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Available for rotation
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Earliest Expiry
          </p>

          <p className="mt-2 text-lg font-bold text-slate-900">
            {priorityBatch
              ? priorityBatch.expiry_date
              : "—"}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            First batch to prioritize
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Rotation Method
          </p>

          <p className="mt-2 text-lg font-bold text-brand-700">
            FEFO
          </p>

          <p className="mt-1 text-xs text-slate-500">
            First Expire, First Out
          </p>
        </div>
      </div>

      {/* FEFO table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-4">
          <h3 className="font-semibold text-slate-900">
            Recommended Inventory Rotation
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Batches are automatically ordered by
            earliest expiry date.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">
                  Priority
                </th>

                <th className="whitespace-nowrap px-4 py-3">
                  Food Item
                </th>

                <th className="whitespace-nowrap px-4 py-3">
                  Batch
                </th>

                <th className="whitespace-nowrap px-4 py-3">
                  Quantity
                </th>

                <th className="whitespace-nowrap px-4 py-3">
                  Expiry
                </th>

                <th className="whitespace-nowrap px-4 py-3">
                  Remaining
                </th>

                <th className="whitespace-nowrap px-4 py-3">
                  Status
                </th>

                <th className="whitespace-nowrap px-4 py-3">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    Loading FEFO inventory...
                  </td>
                </tr>
              ) : fefoBatches.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No active batches available for
                    FEFO rotation.
                  </td>
                </tr>
              ) : (
                fefoBatches.map((batch, index) => {
                  const food =
                    foodItemMap[
                      batch.food_item_id
                    ];

                  const daysRemaining =
                    getDaysRemaining(
                      batch.expiry_date
                    );

                  return (
                    <tr
                      key={batch.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getPriorityStyle(
                            index,
                            daysRemaining
                          )}`}
                        >
                          #{index + 1}{" "}
                          {getPriorityLabel(
                            index,
                            daysRemaining
                          )}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">
                        {food?.name || "—"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <Link
                          to={`/batches/${batch.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {batch.batch_code}
                        </Link>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {batch.quantity}{" "}
                        {batch.unit}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {batch.expiry_date}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={
                            daysRemaining <= 2
                              ? "font-semibold text-red-600"
                              : daysRemaining <= 5
                              ? "font-semibold text-amber-600"
                              : "text-slate-600"
                          }
                        >
                          {daysRemaining < 0
                            ? "Expired"
                            : daysRemaining === 0
                            ? "Expires today"
                            : `${daysRemaining} days`}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge
                          status={batch.status}
                        />
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <Link
                          to={`/batches/${batch.id}`}
                          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                        >
                          View Batch
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explanation */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">
          How FEFO works
        </h3>

        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <p>
            <strong>1.</strong> FoodCare reads the
            expiry date of each active batch.
          </p>

          <p>
            <strong>2.</strong> Batches are sorted from
            earliest expiry to latest expiry.
          </p>

          <p>
            <strong>3.</strong> The batch with the
            earliest expiry receives the highest
            rotation priority.
          </p>

          <p>
            <strong>4.</strong> Expired and out-of-stock
            batches are excluded from the active
            rotation list.
          </p>
        </div>
      </div>
    </div>
  );
}