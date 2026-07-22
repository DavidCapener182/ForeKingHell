import { randomUUID } from "node:crypto";

import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the live RLS persona check.");
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const personas = {
  owner: randomUUID(),
  coach: randomUUID(),
  viewer: randomUUID(),
  editor: randomUUID(),
  friend: randomUUID(),
  stranger: randomUUID(),
  blocked: randomUUID(),
  moderator: randomUUID(),
  administrator: randomUUID(),
};
const ownerClub = randomUUID();
const strangerClub = randomUUID();
const ownInsertClub = randomUUID();
const privateGroup = randomUUID();
const visibleCoachInteraction = randomUUID();
const privateCoachInteraction = randomUUID();
const insertedCoachInteraction = randomUUID();
let evidence;

try {
  await sql.begin(async (tx) => {
    for (const [persona, id] of Object.entries(personas)) {
      await tx`
        insert into fkh_users (id, email, name)
        values (${id}, ${`rls-${persona}-${id}@example.invalid`}, ${`RLS ${persona} probe`})
      `;
    }

    await tx`
      insert into fkh_clubs (id, user_id, type, normalized_club_key)
      values
        (${ownerClub}, ${personas.owner}, 'Driver', 'rls-owner-driver'),
        (${strangerClub}, ${personas.stranger}, 'Driver', 'rls-stranger-driver')
    `;
    await tx`
      insert into fkh_account_memberships (owner_user_id, member_user_id, role)
      values
        (${personas.owner}, ${personas.coach}, 'coach'),
        (${personas.owner}, ${personas.viewer}, 'viewer'),
        (${personas.owner}, ${personas.editor}, 'editor')
    `;
    await tx`
      insert into fkh_coach_player_interactions (
        id,
        player_user_id,
        coach_user_id,
        interaction_type,
        visibility,
        title,
        body
      )
      values
        (
          ${visibleCoachInteraction},
          ${personas.owner},
          ${personas.coach},
          'player_note',
          'player_visible',
          'Player-visible rollback probe',
          'Visible only to the player and assigned coach.'
        ),
        (
          ${privateCoachInteraction},
          ${personas.owner},
          ${personas.coach},
          'private_note',
          'coach_only',
          'Coach-only rollback probe',
          'Visible only to the assigned coach.'
        )
    `;
    await tx`
      insert into fkh_friendships (user_a_id, user_b_id)
      values (
        least(${personas.owner}::uuid, ${personas.friend}::uuid),
        greatest(${personas.owner}::uuid, ${personas.friend}::uuid)
      )
    `;
    await tx`
      insert into fkh_user_blocks (blocker_user_id, blocked_user_id, reason)
      values (${personas.owner}, ${personas.blocked}, 'RLS rollback-only probe')
    `;
    await tx`
      insert into fkh_groups (id, owner_user_id, slug, name, visibility)
      values (
        ${privateGroup},
        ${personas.owner},
        ${`rls-private-${privateGroup}`},
        'RLS private group',
        'private'
      )
    `;
    await tx`
      insert into fkh_group_memberships (group_id, user_id, role, status)
      values (${privateGroup}, ${personas.moderator}, 'moderator', 'active')
    `;
    await tx`
      insert into fkh_admin_users (user_id, role, status)
      values (${personas.administrator}, 'operator', 'active')
    `;

    async function asAuthenticated(userId, operation) {
      await tx.unsafe("reset role");
      await tx.unsafe("set local role authenticated");
      await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
      return operation();
    }

    async function visibleProbeClubs(userId) {
      return asAuthenticated(
        userId,
        () => tx`
        select id, user_id
        from fkh_clubs
        where id in (${ownerClub}, ${strangerClub})
        order by id
      `,
      );
    }

    const ownerVisible = await visibleProbeClubs(personas.owner);
    const ownerCrossTenantUpdate = await asAuthenticated(
      personas.owner,
      () => tx`
        update fkh_clubs set model = 'blocked-owner-cross-tenant-write'
        where id = ${strangerClub}
        returning id
      `,
    );
    const ownerInsert = await asAuthenticated(
      personas.owner,
      () => tx`
        insert into fkh_clubs (id, user_id, type, normalized_club_key)
        values (${ownInsertClub}, ${personas.owner}, '7 Iron', 'rls-owner-7i')
        returning id
      `,
    );

    const coachVisible = await visibleProbeClubs(personas.coach);
    const coachUpdates = await asAuthenticated(
      personas.coach,
      () => tx`
        update fkh_clubs set model = 'blocked-coach-write'
        where id = ${ownerClub}
        returning id
      `,
    );
    const coachInteractionInsert = await asAuthenticated(
      personas.coach,
      () => tx`
        insert into fkh_coach_player_interactions (
          id,
          player_user_id,
          coach_user_id,
          interaction_type,
          visibility,
          title,
          body
        )
        values (
          ${insertedCoachInteraction},
          ${personas.owner},
          ${personas.coach},
          'goal_review',
          'player_visible',
          'Coach-created rollback probe',
          'Created through the authenticated coach policy.'
        )
        returning id
      `,
    );
    const coachInteractionRows = await asAuthenticated(
      personas.coach,
      () => tx`
        select id
        from fkh_coach_player_interactions
        where player_user_id = ${personas.owner}
      `,
    );
    const coachInteractionUpdates = await asAuthenticated(
      personas.coach,
      () => tx`
        update fkh_coach_player_interactions
        set status = 'completed', completed_at = now(), updated_at = now()
        where id = ${visibleCoachInteraction}
        returning id
      `,
    );
    const ownerInteractionRows = await asAuthenticated(
      personas.owner,
      () => tx`
        select id
        from fkh_coach_player_interactions
        where player_user_id = ${personas.owner}
      `,
    );
    const ownerInteractionUpdates = await asAuthenticated(
      personas.owner,
      () => tx`
        update fkh_coach_player_interactions
        set status = 'acknowledged', updated_at = now()
        where id = ${visibleCoachInteraction}
        returning id
      `,
    );
    const viewerInteractionRows = await asAuthenticated(
      personas.viewer,
      () => tx`
        select id
        from fkh_coach_player_interactions
        where player_user_id = ${personas.owner}
      `,
    );
    const viewerVisible = await visibleProbeClubs(personas.viewer);
    const viewerUpdates = await asAuthenticated(
      personas.viewer,
      () => tx`
        update fkh_clubs set model = 'blocked-viewer-write'
        where id = ${ownerClub}
        returning id
      `,
    );
    const editorVisible = await visibleProbeClubs(personas.editor);
    const editorUpdates = await asAuthenticated(
      personas.editor,
      () => tx`
        update fkh_clubs set model = 'allowed-editor-write'
        where id = ${ownerClub}
        returning id
      `,
    );
    const friendVisible = await visibleProbeClubs(personas.friend);
    const strangerVisible = await visibleProbeClubs(personas.stranger);
    const blockedVisible = await visibleProbeClubs(personas.blocked);
    const blockEvidence = await asAuthenticated(
      personas.blocked,
      () => tx`
        select public.fkh_has_social_block(
          ${personas.blocked}::uuid,
          ${personas.owner}::uuid
        ) as blocked
      `,
    );
    const moderatorGroups = await asAuthenticated(
      personas.moderator,
      () => tx`
        select id from fkh_groups where id = ${privateGroup}
      `,
    );
    const moderatorUpdates = await asAuthenticated(
      personas.moderator,
      () => tx`
        update fkh_groups set description = 'moderator update allowed'
        where id = ${privateGroup}
        returning id
      `,
    );
    const administratorRows = await asAuthenticated(
      personas.administrator,
      () => tx`
        select user_id
        from fkh_admin_users
        where user_id in (${personas.administrator}, ${personas.owner})
      `,
    );
    const administratorVisibleClubs = await visibleProbeClubs(personas.administrator);

    await tx.unsafe("reset role");
    await tx`
      delete from fkh_account_memberships
      where owner_user_id = ${personas.owner}
        and member_user_id = ${personas.coach}
    `;
    const revokedCoachInteractionRows = await asAuthenticated(
      personas.coach,
      () => tx`
        select id
        from fkh_coach_player_interactions
        where player_user_id = ${personas.owner}
      `,
    );

    await tx.unsafe("reset role");
    await tx.unsafe("set local role anon");
    await tx`select set_config('request.jwt.claim.sub', '', true)`;
    const anonymousRows = await tx`
      select id from fkh_clubs where id in (${ownerClub}, ${strangerClub})
    `;

    evidence = {
      owner: {
        visibleRows: ownerVisible.length,
        onlyOwnRowsVisible: ownerVisible.every((row) => row.user_id === personas.owner),
        crossTenantUpdates: ownerCrossTenantUpdate.length,
        ownInserts: ownerInsert.length,
      },
      coach: { visibleOwnerRows: coachVisible.length, updates: coachUpdates.length },
      coachWorkspace: {
        coachVisibleRows: coachInteractionRows.length,
        coachInserts: coachInteractionInsert.length,
        coachUpdates: coachInteractionUpdates.length,
        playerVisibleRows: ownerInteractionRows.length,
        playerUpdates: ownerInteractionUpdates.length,
        viewerVisibleRows: viewerInteractionRows.length,
        revokedCoachVisibleRows: revokedCoachInteractionRows.length,
      },
      viewer: { visibleOwnerRows: viewerVisible.length, updates: viewerUpdates.length },
      editor: { visibleOwnerRows: editorVisible.length, updates: editorUpdates.length },
      friend: { visiblePrivateGolfRows: friendVisible.length },
      stranger: { visibleOwnRows: strangerVisible.length },
      blockedUser: {
        visiblePrivateGolfRows: blockedVisible.length,
        blockDetected: blockEvidence[0]?.blocked === true,
      },
      groupModerator: {
        visiblePrivateGroups: moderatorGroups.length,
        updates: moderatorUpdates.length,
      },
      administrator: {
        visibleOwnAdminRows: administratorRows.length,
        visiblePrivateGolfRows: administratorVisibleClubs.length,
      },
      anonymous: { visiblePrivateGolfRows: anonymousRows.length },
      transaction: "rolled-back",
    };

    throw new Error("ROLLBACK_RLS_PROBE");
  });
} catch (error) {
  if (!(error instanceof Error) || error.message !== "ROLLBACK_RLS_PROBE") throw error;
} finally {
  await sql.end();
}

const passed =
  evidence?.owner.visibleRows === 1 &&
  evidence.owner.onlyOwnRowsVisible &&
  evidence.owner.crossTenantUpdates === 0 &&
  evidence.owner.ownInserts === 1 &&
  evidence.coach.visibleOwnerRows === 1 &&
  evidence.coach.updates === 0 &&
  evidence.coachWorkspace.coachVisibleRows === 3 &&
  evidence.coachWorkspace.coachInserts === 1 &&
  evidence.coachWorkspace.coachUpdates === 1 &&
  evidence.coachWorkspace.playerVisibleRows === 2 &&
  evidence.coachWorkspace.playerUpdates === 0 &&
  evidence.coachWorkspace.viewerVisibleRows === 0 &&
  evidence.coachWorkspace.revokedCoachVisibleRows === 0 &&
  evidence.viewer.visibleOwnerRows === 1 &&
  evidence.viewer.updates === 0 &&
  evidence.editor.visibleOwnerRows === 1 &&
  evidence.editor.updates === 1 &&
  evidence.friend.visiblePrivateGolfRows === 0 &&
  evidence.stranger.visibleOwnRows === 1 &&
  evidence.blockedUser.visiblePrivateGolfRows === 0 &&
  evidence.blockedUser.blockDetected &&
  evidence.groupModerator.visiblePrivateGroups === 1 &&
  evidence.groupModerator.updates === 1 &&
  evidence.administrator.visibleOwnAdminRows === 1 &&
  evidence.administrator.visiblePrivateGolfRows === 0 &&
  evidence.anonymous.visiblePrivateGolfRows === 0 &&
  evidence.transaction === "rolled-back";

if (!passed) {
  console.error(JSON.stringify(evidence));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(evidence));
}
