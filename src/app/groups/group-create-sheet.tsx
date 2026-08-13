"use client";

import { Plus } from "lucide-react";

import { createGroupAction } from "@/app/groups/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

const visibilityOptions = ["private", "friends", "public"] as const;

export function GroupCreateSheet({ groupTypes }: { groupTypes: readonly string[] }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button>
          <Plus className="size-4" /> Create group
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Create a group</SheetTitle>
          <SheetDescription>
            Start a private friend group, society, coach stable, or public launch-monitor league.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <GroupCreateForm groupTypes={groupTypes} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function GroupCreateForm({ groupTypes }: { groupTypes: readonly string[] }) {
  return (
    <form action={createGroupAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="group-name">Name</Label>
        <Input id="group-name" name="name" placeholder="LM World Tour league" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="group-type">Type</Label>
        <Select name="groupType" defaultValue={groupTypes[0] ?? "friends"}>
          <SelectTrigger id="group-type" className="w-full">
            <SelectValue placeholder="Choose a group type" />
          </SelectTrigger>
          <SelectContent>
            {groupTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {titleCase(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="group-visibility">Visibility</Label>
        <Select name="visibility" defaultValue="private">
          <SelectTrigger id="group-visibility" className="w-full">
            <SelectValue placeholder="Choose visibility" />
          </SelectTrigger>
          <SelectContent>
            {visibilityOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {titleCase(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="group-description">Description</Label>
        <Textarea
          id="group-description"
          name="description"
          rows={4}
          placeholder="What the group is for and who should join"
        />
      </div>
      <Button type="submit">
        <Plus className="size-4" /> Create group
      </Button>
    </form>
  );
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
