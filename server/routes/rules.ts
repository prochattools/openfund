import { Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { createRule, deleteRule, updateRule, previewRuleMatchesForUser, applyRuleToTransactions } from '../services/ruleEngine';
import { createAuditLog } from '../services/auditLogService';
import { getRequestActor, requireAdmin } from '../auth/requestContext';
import { readRouteParam } from './routeParams';
import type { RuleMatchField, RuleMatchType } from '@prisma/client';

const logRequest = (req: Request) => {
  console.log(`[rules] ${req.method} ${req.originalUrl} user=${req.header('x-user-id') ?? 'unknown'}`);
};

const parsePriority = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed;
};

const isMatchType = (value: string): value is RuleMatchType =>
  ['regex', 'contains', 'startsWith', 'endsWith'].includes(value);

const isMatchField = (value: string): value is RuleMatchField =>
  ['description', 'counterparty', 'reference', 'source'].includes(value);

export const getRules = async (req: Request, res: Response) => {
  logRequest(req);
  const { userId } = getRequestActor(req);

  try {
    const rules = await prisma.categorizationRule.findMany({
      where: { userId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    return res.json(rules);
  } catch (error) {
    console.error('Categorisatieregels konden niet worden geladen', error);
    return res.status(500).json({ error: 'Categorisatieregels konden niet worden geladen.' });
  }
};

export const postRule = async (req: Request, res: Response) => {
  logRequest(req);
  const actor = requireAdmin(req, res);
  if (!actor) return;

  const { userId, actorId, actorEmail } = actor;
  const { label, pattern, categoryId, conditions } = req.body ?? {};

  if (!label || !categoryId) {
    return res.status(400).json({ error: 'Naam en categorie zijn verplicht.' });
  }

  const matchType = typeof req.body.matchType === 'string' && isMatchType(req.body.matchType)
    ? req.body.matchType
    : undefined;
  const matchField = typeof req.body.matchField === 'string' && isMatchField(req.body.matchField)
    ? req.body.matchField
    : undefined;
  const priority = parsePriority(req.body.priority);
  const isActive = req.body.isActive === undefined ? undefined : Boolean(req.body.isActive);
  const createdBy = actorEmail ?? actorId ?? 'system';

  try {
    const rule = await prisma.$transaction(async (tx) => {
      const created = await createRule(tx, userId, {
        label,
        pattern,
        categoryId,
        matchType,
        matchField,
        priority,
        isActive,
        createdBy,
        conditions,
      });

      await createAuditLog(tx, {
        userId,
        actorId,
        actorEmail,
        action: 'categorizationRule.created',
        entityType: 'categorizationRule',
        entityId: created.id,
        after: {
          label: created.label,
          categoryId: created.categoryId,
          pattern: created.pattern,
          matchType: created.matchType,
          matchField: created.matchField,
          priority: created.priority,
          isActive: created.isActive,
        },
      });

      return tx.categorizationRule.findUnique({
        where: { id: created.id },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    return res.status(201).json(rule);
  } catch (error) {
    console.error('Categorisatieregel kon niet worden gemaakt', error);
    return res.status(500).json({ error: 'Categorisatieregel kon niet worden gemaakt.' });
  }
};

export const patchRule = async (req: Request, res: Response) => {
  logRequest(req);
  const actor = requireAdmin(req, res);
  if (!actor) return;

  const { userId, actorId, actorEmail } = actor;
  const ruleId = readRouteParam(req, 'id');
  if (!ruleId) {
    return res.status(400).json({ error: 'Regel id ontbreekt.' });
  }

  const updates: Record<string, unknown> = {};

  if (typeof req.body.label === 'string') updates.label = req.body.label;
  if (typeof req.body.pattern === 'string') updates.pattern = req.body.pattern;
  if (typeof req.body.categoryId === 'string') updates.categoryId = req.body.categoryId;
  if (req.body.priority !== undefined) updates.priority = parsePriority(req.body.priority);
  if (req.body.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);
  if (typeof req.body.matchType === 'string' && isMatchType(req.body.matchType)) {
    updates.matchType = req.body.matchType;
  }
  if (typeof req.body.matchField === 'string' && isMatchField(req.body.matchField)) {
    updates.matchField = req.body.matchField;
  }
  if (Array.isArray(req.body.conditions)) {
    updates.conditions = req.body.conditions;
    if (!updates.pattern && req.body.conditions.length) {
      updates.pattern = req.body.conditions[0].value ?? updates.pattern;
    }
  }

  try {
    const rule = await prisma.$transaction(async (tx) => {
      const before = await tx.categorizationRule.findFirst({ where: { id: ruleId, userId } });
      await updateRule(tx, userId, ruleId, updates);
      const updated = await tx.categorizationRule.findUnique({
        where: { id: ruleId },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      await createAuditLog(tx, {
        userId,
        actorId,
        actorEmail,
        action: 'categorizationRule.updated',
        entityType: 'categorizationRule',
        entityId: ruleId,
        before: before
          ? {
              label: before.label,
              categoryId: before.categoryId,
              pattern: before.pattern,
              matchType: before.matchType,
              matchField: before.matchField,
              priority: before.priority,
              isActive: before.isActive,
            }
          : null,
        after: updated
          ? {
              label: updated.label,
              categoryId: updated.categoryId,
              pattern: updated.pattern,
              matchType: updated.matchType,
              matchField: updated.matchField,
              priority: updated.priority,
              isActive: updated.isActive,
            }
          : null,
      });

      return updated;
    });
    return res.json(rule);
  } catch (error) {
    console.error('Categorisatieregel kon niet worden bijgewerkt', error);
    return res.status(500).json({ error: 'Categorisatieregel kon niet worden bijgewerkt.' });
  }
};

export const previewRule = async (req: Request, res: Response) => {
  logRequest(req);
  const { userId } = getRequestActor(req);
  const ruleId = readRouteParam(req, 'id');
  const scope = req.body?.scope;
  const importBatchId = req.body?.importBatchId;

  if (!ruleId || !scope) {
    return res.status(400).json({ error: 'Regel en bereik zijn verplicht.' });
  }

  try {
    const matches = await prisma.$transaction((tx) =>
      previewRuleMatchesForUser(tx, {
        userId,
        ruleId,
        scope: scope === 'review-queue' ? 'review-queue' : { importBatchId },
      }),
    );
    const safe = matches.map((tx) => ({
      id: tx.id,
      date: tx.date,
      description: tx.description,
      amountMinor: tx.amountMinor?.toString?.() ?? null,
      currency: tx.currency,
      account: tx.account ? { name: tx.account.name, identifier: tx.account.identifier } : null,
      categoryId: tx.categoryId,
      categoryName: tx.category?.name ?? null,
    }));
    return res.json(safe);
  } catch (error) {
    console.error('Voorbeeld van regel kon niet worden geladen', error);
    return res.status(500).json({ error: 'Voorbeeld van regel kon niet worden geladen.' });
  }
};

export const applyRule = async (req: Request, res: Response) => {
  logRequest(req);
  const actor = requireAdmin(req, res);
  if (!actor) return;

  const { userId, actorId, actorEmail } = actor;
  const ruleId = readRouteParam(req, 'id');
  const transactionIds: string[] = Array.isArray(req.body?.transactionIds) ? req.body.transactionIds : [];

  if (!ruleId || !transactionIds.length) {
    return res.status(400).json({ error: 'Regel en transacties zijn verplicht.' });
  }

  try {
    const count = await prisma.$transaction(async (tx) => {
      const updated = await applyRuleToTransactions(tx, {
        userId,
        ruleId,
        transactionIds,
      });

      await createAuditLog(tx, {
        userId,
        actorId,
        actorEmail,
        action: 'categorizationRule.applied',
        entityType: 'categorizationRule',
        entityId: ruleId,
        metadata: {
          transactionCount: transactionIds.length,
          updated,
        },
      });

      return updated;
    });
    return res.json({ updated: count });
  } catch (error) {
    console.error('Categorisatieregel kon niet worden toegepast', error);
    return res.status(500).json({ error: 'Categorisatieregel kon niet worden toegepast.' });
  }
};

export const removeRule = async (req: Request, res: Response) => {
  logRequest(req);
  const actor = requireAdmin(req, res);
  if (!actor) return;

  const { userId, actorId, actorEmail } = actor;
  const ruleId = readRouteParam(req, 'id');
  if (!ruleId) {
    return res.status(400).json({ error: 'Regel id ontbreekt.' });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.categorizationRule.findFirst({ where: { id: ruleId, userId } });
      await deleteRule(tx, userId, ruleId);
      await createAuditLog(tx, {
        userId,
        actorId,
        actorEmail,
        action: 'categorizationRule.deleted',
        entityType: 'categorizationRule',
        entityId: ruleId,
        before: existing
          ? {
              label: existing.label,
              categoryId: existing.categoryId,
              pattern: existing.pattern,
              matchType: existing.matchType,
              matchField: existing.matchField,
              priority: existing.priority,
              isActive: existing.isActive,
            }
          : null,
      });
    });
    return res.status(204).send();
  } catch (error) {
    console.error('Categorisatieregel kon niet worden verwijderd', error);
    return res.status(500).json({ error: 'Categorisatieregel kon niet worden verwijderd.' });
  }
};
