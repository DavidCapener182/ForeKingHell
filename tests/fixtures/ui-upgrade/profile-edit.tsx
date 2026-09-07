import { createRoot } from "react-dom/client";
import { ProfileEditSheet } from "@/app/profile/profile-edit-sheet";
import { ProfileMediaEditor } from "@/app/profile/profile-media-editor";
import { Button } from "@/components/ui/button";
createRoot(document.getElementById("root")!).render(
  <ProfileEditSheet>
    <ProfileMediaEditor
      displayName="Synthetic media fixture"
      username="fixture"
      initialAvatarUrl="/saved-avatar.png"
      publicHref="/profile/fixture"
      formId="profile-settings-form"
    />
    <label>
      Display name
      <input name="displayName" defaultValue="Original name" required />
    </label>
    <Button type="submit">Save profile</Button>
  </ProfileEditSheet>,
);
