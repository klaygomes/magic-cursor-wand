# Configuration reference

This page shows each section and field of the default schema. A script makes the tables from the field metadata in the source code.

A path has the format `<section>.<field>`. Use a path in the `locked` option. In the `config` option and in `setConfig`, use an object for each section.

Each section other than `theme` also has the field `enabled`. The default value is `true`.

<!--@include: ./configuration.generated.md-->
