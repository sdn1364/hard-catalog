import { Box, Image } from "@mantine/core";
import { IconPhoto } from "@tabler/icons-react";

type ProjectThumbProps = {
  src: string | null;
};

export function ProjectThumb({ src }: ProjectThumbProps) {
  if (!src) {
    return (
      <Box
        w={48}
        h={48}
        style={{
          borderRadius: "var(--mantine-radius-sm)",
          border: "1px solid var(--mantine-color-dark-4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        bg="dark.6"
      >
        <IconPhoto size={20} stroke={1.25} opacity={0.35} />
      </Box>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      w={48}
      h={48}
      radius="sm"
      fit="cover"
      fallbackSrc=""
    />
  );
}
